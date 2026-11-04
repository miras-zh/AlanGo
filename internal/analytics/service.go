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

func (s *Service) TrackEvent(eventType, targetType string, targetID uint64, platform, source, deviceID, ip, userAgent string) error {
	eventType = strings.TrimSpace(eventType)
	if !IsValidEvent(eventType) {
		return nil
	}

	deviceID = strings.TrimSpace(deviceID)
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
		TargetType: strings.TrimSpace(targetType),
		TargetID:   targetID,
		Platform:   strings.TrimSpace(platform),
		Source:     strings.TrimSpace(source),
		DeviceID:   deviceID,
		IP:         strings.TrimSpace(ip),
		UserAgent:  strings.TrimSpace(userAgent),
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

	for i := 23; i >= 0; i-- {
		slotTime := currentHourBucket.Add(-time.Duration(i) * time.Hour)
		pt := TrafficPoint{
			Timestamp: slotTime.Unix(),
			Label:     fmt.Sprintf("%02d:00", slotTime.Hour()),
			Hour:      slotTime.Hour(),
		}
		if slotTime.Equal(currentHourBucket) {
			pt.PeakOnline = report.CurrentOnline
			pt.TotalUnique = report.CurrentOnline
			pt.Users = report.CurrentUsers
			pt.Guests = report.CurrentGuests
		}
		report.Points = append(report.Points, pt)
	}
	report.PeakOnline = report.CurrentOnline
	report.PeakTime = "Сейчас"
	return report, nil
}
