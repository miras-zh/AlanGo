package analytics

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var updatePeakScript = redis.NewScript(`
	local current = tonumber(ARGV[1])
	local peakKey = KEYS[1]
	local oldPeak = tonumber(redis.call('get', peakKey) or '0')
	if current > oldPeak then
		redis.call('set', peakKey, current)
		redis.call('expire', peakKey, 2592000)
		return current
	end
	return oldPeak
`)

var validEvents = map[string]bool{
	EventAppInstall:  true,
	EventFirstLaunch: true,
	EventFirstValue:  true,
	EventCoreAction:  true,
	EventPaywallView: true,
	EventTrialStart:  true,
	EventSubscribe:   true,
	EventStoreClick:  true,
	EventItemView:    true,
	EventItemShare:   true,
}

func IsValidEvent(eventType string) bool {
	return validEvents[strings.TrimSpace(eventType)]
}

type Service struct {
	db  *gorm.DB
	rdb *redis.Client
}

func NewService(db *gorm.DB, rdb *redis.Client) *Service {
	return &Service{db: db, rdb: rdb}
}

func truncateStr(s string, maxBytes int) string {
	s = strings.TrimSpace(s)
	if len(s) <= maxBytes {
		return s
	}
	return s[:maxBytes]
}

func (s *Service) TrackEvent(eventType, targetType string, targetID uint64, platform, source, deviceID, ip, userAgent string) error {
	eventType = strings.TrimSpace(eventType)
	if !IsValidEvent(eventType) {
		return nil
	}

	deviceID = truncateStr(deviceID, 128)
	if (eventType == EventAppInstall || eventType == EventFirstLaunch) && deviceID != "" {
		var count int64
		if err := s.db.Model(&Event{}).
			Where("event_type = ? AND device_id = ?", eventType, deviceID).
			Count(&count).Error; err == nil && count > 0 {
			return nil
		}
	}

	ev := Event{
		EventType:  eventType,
		TargetType: truncateStr(targetType, 32),
		TargetID:   targetID,
		Platform:   truncateStr(platform, 32),
		Source:     truncateStr(source, 64),
		DeviceID:   deviceID,
		IP:         truncateStr(ip, 64),
		UserAgent:  truncateStr(userAgent, 1024),
		CreatedAt:  time.Now(),
	}

	return s.db.Create(&ev).Error
}

func (s *Service) GetFunnelSummary(ctx context.Context) (*FunnelSummary, error) {
	type row struct {
		EventType string `gorm:"column:event_type"`
		Count     int64  `gorm:"column:count"`
	}
	var rows []row
	if err := s.db.WithContext(ctx).Model(&Event{}).
		Select("event_type, count(*) as count").
		Group("event_type").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	counts := make(map[string]int64, len(rows))
	for _, r := range rows {
		counts[r.EventType] = r.Count
	}

	return &FunnelSummary{
		AppInstall:  counts[EventAppInstall],
		FirstLaunch: counts[EventFirstLaunch],
		FirstValue:  counts[EventFirstValue],
		CoreAction:  counts[EventCoreAction],
		PaywallView: counts[EventPaywallView],
		TrialStart:  counts[EventTrialStart],
		Subscribe:   counts[EventSubscribe],
		StoreClick:  counts[EventStoreClick],
	}, nil
}

const onlineWindowSeconds = 180

func (s *Service) Heartbeat(ctx context.Context, userID uint, guestID, platform, path string) error {
	if s.rdb == nil {
		return nil
	}

	platform = strings.ToLower(strings.TrimSpace(platform))
	if platform != "ios" && platform != "android" && platform != "web" {
		platform = "web"
	}
	path = strings.TrimSpace(path)
	if len(path) > 256 {
		path = path[:256]
	}
	guestID = strings.TrimSpace(guestID)
	if len(guestID) > 64 {
		guestID = guestID[:64]
	}

	if userID == 0 && guestID == "" {
		return nil
	}

	now := time.Now().Unix()
	nowFloat := float64(now)
	meta := OnlineMeta{
		Platform: platform,
		Path:     path,
		LastSeen: now,
	}
	metaBytes, _ := json.Marshal(meta)

	hourKey := time.Now().UTC().Format("2006010215")
	hourUKey := "traffic:h:" + hourKey + ":u"
	hourGKey := "traffic:h:" + hourKey + ":g"
	hourPKey := "traffic:h:" + hourKey + ":plat:" + platform
	hourPeakKey := "traffic:h:" + hourKey + ":peak"

	pipe := s.rdb.Pipeline()
	if userID > 0 {
		userKey := strconv.FormatUint(uint64(userID), 10)
		pipe.ZAdd(ctx, "online:users", redis.Z{Score: nowFloat, Member: userKey})
		pipe.Set(ctx, "online:meta:u:"+userKey, metaBytes, 5*time.Minute)
		pipe.ZAdd(ctx, "online:platform:"+platform, redis.Z{Score: nowFloat, Member: "u:" + userKey})
		if guestID != "" {
			pipe.ZRem(ctx, "online:guests", guestID)
			pipe.ZRem(ctx, "online:platform:"+platform, "g:"+guestID)
		}
		pipe.SAdd(ctx, hourUKey, userKey)
		pipe.Expire(ctx, hourUKey, 30*24*time.Hour)
	} else {
		pipe.ZAdd(ctx, "online:guests", redis.Z{Score: nowFloat, Member: guestID})
		pipe.Set(ctx, "online:meta:g:"+guestID, metaBytes, 5*time.Minute)
		pipe.ZAdd(ctx, "online:platform:"+platform, redis.Z{Score: nowFloat, Member: "g:" + guestID})
		pipe.SAdd(ctx, hourGKey, guestID)
		pipe.Expire(ctx, hourGKey, 30*24*time.Hour)
	}

	pipe.Incr(ctx, hourPKey)
	pipe.Expire(ctx, hourPKey, 30*24*time.Hour)

	usersCmd := pipe.ZCard(ctx, "online:users")
	guestsCmd := pipe.ZCard(ctx, "online:guests")

	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}

	currentOnline := usersCmd.Val() + guestsCmd.Val()
	if currentOnline > 0 {
		_ = updatePeakScript.Run(ctx, s.rdb, []string{hourPeakKey}, currentOnline).Err()
	}

	return nil
}

func (s *Service) GetOnlineStats(ctx context.Context) (*OnlineStats, error) {
	stats := &OnlineStats{
		ActiveUserIDs: []uint{},
		ActiveUsers:   []ActiveUserRecord{},
	}
	if s.rdb == nil {
		return stats, nil
	}

	now := time.Now().Unix()
	threshold := strconv.FormatInt(now-onlineWindowSeconds, 10)

	pipe := s.rdb.Pipeline()
	pipe.ZRemRangeByScore(ctx, "online:users", "-inf", threshold)
	pipe.ZRemRangeByScore(ctx, "online:guests", "-inf", threshold)
	pipe.ZRemRangeByScore(ctx, "online:platform:web", "-inf", threshold)
	pipe.ZRemRangeByScore(ctx, "online:platform:ios", "-inf", threshold)
	pipe.ZRemRangeByScore(ctx, "online:platform:android", "-inf", threshold)

	usersCmd := pipe.ZCard(ctx, "online:users")
	guestsCmd := pipe.ZCard(ctx, "online:guests")
	webCmd := pipe.ZCard(ctx, "online:platform:web")
	iosCmd := pipe.ZCard(ctx, "online:platform:ios")
	androidCmd := pipe.ZCard(ctx, "online:platform:android")
	activeUsersCmd := pipe.ZRevRange(ctx, "online:users", 0, 49)

	if _, err := pipe.Exec(ctx); err != nil && !errors.Is(err, redis.Nil) {
		return stats, err
	}

	stats.UsersCount = usersCmd.Val()
	stats.GuestsCount = guestsCmd.Val()
	stats.Total = stats.UsersCount + stats.GuestsCount
	stats.Platforms = OnlinePlatforms{
		Web:     webCmd.Val(),
		IOS:     iosCmd.Val(),
		Android: androidCmd.Val(),
	}

	userIDsStr := activeUsersCmd.Val()
	if len(userIDsStr) > 0 {
		var userIDs []uint
		for _, sVal := range userIDsStr {
			if id, err := strconv.ParseUint(sVal, 10, 64); err == nil {
				userIDs = append(userIDs, uint(id))
			}
		}
		stats.ActiveUserIDs = userIDs
	}

	return stats, nil
}

func (s *Service) UpsertHourlyTraffic(ht *HourlyTraffic) error {
	if s.db == nil || ht == nil {
		return nil
	}
	return s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "bucket_time"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"peak_online",
			"unique_users",
			"unique_guests",
			"total_unique",
			"web_count",
			"ios_count",
			"android_count",
			"updated_at",
		}),
	}).Create(ht).Error
}

func (s *Service) readRedisHourBucket(ctx context.Context, t time.Time) (HourlyTraffic, bool) {
	if s.rdb == nil {
		return HourlyTraffic{}, false
	}
	hourKey := t.UTC().Format("2006010215")
	pipe := s.rdb.Pipeline()
	uCmd := pipe.SCard(ctx, "traffic:h:"+hourKey+":u")
	gCmd := pipe.SCard(ctx, "traffic:h:"+hourKey+":g")
	peakCmd := pipe.Get(ctx, "traffic:h:"+hourKey+":peak")
	webCmd := pipe.Get(ctx, "traffic:h:"+hourKey+":plat:web")
	iosCmd := pipe.Get(ctx, "traffic:h:"+hourKey+":plat:ios")
	andCmd := pipe.Get(ctx, "traffic:h:"+hourKey+":plat:android")
	_, err := pipe.Exec(ctx)
	if err != nil && !errors.Is(err, redis.Nil) {
		return HourlyTraffic{}, false
	}

	peak, _ := peakCmd.Int()
	web, _ := webCmd.Int()
	ios, _ := iosCmd.Int()
	and, _ := andCmd.Int()
	u := int(uCmd.Val())
	g := int(gCmd.Val())
	if u == 0 && g == 0 && peak == 0 && web == 0 && ios == 0 && and == 0 {
		return HourlyTraffic{}, false
	}
	return HourlyTraffic{
		BucketTime:   t.UTC().Truncate(time.Hour),
		PeakOnline:   peak,
		UniqueUsers:  u,
		UniqueGuests: g,
		TotalUnique:  u + g,
		WebCount:     web,
		IOSCount:     ios,
		AndroidCount: and,
	}, true
}

func (s *Service) GetTrafficReport(ctx context.Context, period string) (*TrafficReport, error) {
	period = strings.ToLower(strings.TrimSpace(period))
	if period != "7d" && period != "30d" {
		period = "24h"
	}

	report := &TrafficReport{
		Period: period,
		Points: make([]TrafficPoint, 0),
	}

	onlineStats, _ := s.GetOnlineStats(ctx)
	if onlineStats != nil {
		report.CurrentOnline = int(onlineStats.Total)
		report.CurrentUsers = int(onlineStats.UsersCount)
		report.CurrentGuests = int(onlineStats.GuestsCount)
		report.Platforms = onlineStats.Platforms
	}

	now := time.Now().UTC()
	currentHourBucket := now.Truncate(time.Hour)

	if period == "24h" {
		since := currentHourBucket.Add(-23 * time.Hour)
		dbBuckets := make(map[int64]HourlyTraffic)
		if s.db != nil {
			var rows []HourlyTraffic
			if err := s.db.WithContext(ctx).
				Where("bucket_time >= ?", since).
				Order("bucket_time ASC").
				Find(&rows).Error; err == nil {
				for _, r := range rows {
					dbBuckets[r.BucketTime.UTC().Truncate(time.Hour).Unix()] = r
				}
			}
		}

		var sumOnline int
		for i := 23; i >= 0; i-- {
			slotTime := currentHourBucket.Add(-time.Duration(i) * time.Hour)
			row := dbBuckets[slotTime.Unix()]
			if live, ok := s.readRedisHourBucket(ctx, slotTime); ok {
				if live.PeakOnline > row.PeakOnline {
					row.PeakOnline = live.PeakOnline
				}
				if live.TotalUnique > row.TotalUnique {
					row.UniqueUsers = live.UniqueUsers
					row.UniqueGuests = live.UniqueGuests
					row.TotalUnique = live.TotalUnique
				}
				if live.WebCount > row.WebCount {
					row.WebCount = live.WebCount
				}
				if live.IOSCount > row.IOSCount {
					row.IOSCount = live.IOSCount
				}
				if live.AndroidCount > row.AndroidCount {
					row.AndroidCount = live.AndroidCount
				}
			}
			pt := TrafficPoint{
				Timestamp:   slotTime.Unix(),
				Label:       fmt.Sprintf("%02d:00", slotTime.Hour()),
				Hour:        slotTime.Hour(),
				PeakOnline:  row.PeakOnline,
				TotalUnique: row.TotalUnique,
				Users:       row.UniqueUsers,
				Guests:      row.UniqueGuests,
				Web:         row.WebCount,
				IOS:         row.IOSCount,
				Android:     row.AndroidCount,
			}
			if slotTime.Equal(currentHourBucket) && report.CurrentOnline > pt.PeakOnline {
				pt.PeakOnline = report.CurrentOnline
			}
			if slotTime.Equal(currentHourBucket) && pt.TotalUnique == 0 && report.CurrentOnline > 0 {
				pt.TotalUnique = report.CurrentOnline
				pt.Users = report.CurrentUsers
				pt.Guests = report.CurrentGuests
			}
			sumOnline += pt.PeakOnline
			report.TotalVisitors += pt.TotalUnique
			report.TotalUsers += pt.Users
			report.TotalGuests += pt.Guests
			if pt.PeakOnline >= report.PeakOnline {
				report.PeakOnline = pt.PeakOnline
				report.PeakHour = pt.Hour
				report.PeakTime = pt.Label
			}
			report.Points = append(report.Points, pt)
		}
		if len(report.Points) > 0 {
			report.AvgOnline = float64(sumOnline) / float64(len(report.Points))
		}
		if report.PeakTime == "" {
			report.PeakTime = "Сейчас"
		}
		return report, nil
	}

	days := 7
	if period == "30d" {
		days = 30
	}
	todayUTC := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	since := todayUTC.AddDate(0, 0, -(days - 1))

	dayMap := make(map[string]*TrafficPoint)
	if s.db != nil {
		var rows []HourlyTraffic
		if err := s.db.WithContext(ctx).
			Where("bucket_time >= ?", since).
			Order("bucket_time ASC").
			Find(&rows).Error; err == nil {
			for _, r := range rows {
				k := r.BucketTime.UTC().Format("2006-01-02")
				pt, ok := dayMap[k]
				if !ok {
					pt = &TrafficPoint{}
					dayMap[k] = pt
				}
				if r.PeakOnline > pt.PeakOnline {
					pt.PeakOnline = r.PeakOnline
					pt.Hour = r.BucketTime.UTC().Hour()
				}
				pt.TotalUnique += r.TotalUnique
				pt.Users += r.UniqueUsers
				pt.Guests += r.UniqueGuests
				pt.Web += r.WebCount
				pt.IOS += r.IOSCount
				pt.Android += r.AndroidCount
			}
		}
	}

	// Merge today's live Redis hourly buckets into today's aggregate.
	todayKey := todayUTC.Format("2006-01-02")
	for h := 0; h <= now.Hour(); h++ {
		slotTime := todayUTC.Add(time.Duration(h) * time.Hour)
		if live, ok := s.readRedisHourBucket(ctx, slotTime); ok {
			pt, exists := dayMap[todayKey]
			if !exists {
				pt = &TrafficPoint{}
				dayMap[todayKey] = pt
			}
			if live.PeakOnline > pt.PeakOnline {
				pt.PeakOnline = live.PeakOnline
				pt.Hour = h
			}
			if live.TotalUnique > pt.TotalUnique {
				pt.TotalUnique = live.TotalUnique
				pt.Users = live.UniqueUsers
				pt.Guests = live.UniqueGuests
			}
		}
	}

	var sumOnline int
	for i := days - 1; i >= 0; i-- {
		d := todayUTC.AddDate(0, 0, -i)
		k := d.Format("2006-01-02")
		pt := TrafficPoint{
			Timestamp: d.Unix(),
			Label:     d.Format("02.01"),
		}
		if agg, ok := dayMap[k]; ok {
			pt.Hour = agg.Hour
			pt.PeakOnline = agg.PeakOnline
			pt.TotalUnique = agg.TotalUnique
			pt.Users = agg.Users
			pt.Guests = agg.Guests
			pt.Web = agg.Web
			pt.IOS = agg.IOS
			pt.Android = agg.Android
		}
		if i == 0 && report.CurrentOnline > pt.PeakOnline {
			pt.PeakOnline = report.CurrentOnline
		}
		sumOnline += pt.PeakOnline
		report.TotalVisitors += pt.TotalUnique
		report.TotalUsers += pt.Users
		report.TotalGuests += pt.Guests
		if pt.PeakOnline >= report.PeakOnline {
			report.PeakOnline = pt.PeakOnline
			report.PeakHour = pt.Hour
			report.PeakTime = pt.Label
		}
		report.Points = append(report.Points, pt)
	}
	if len(report.Points) > 0 {
		report.AvgOnline = float64(sumOnline) / float64(len(report.Points))
	}
	if report.PeakTime == "" {
		report.PeakTime = "Сейчас"
	}
	return report, nil
}
