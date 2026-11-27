package sport

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"alango/internal/auth"

	"github.com/gorilla/mux"
)

var (
	ErrExpenseNotFound        = errors.New("расход не найден")
	ErrInvalidExpenseCategory = errors.New("недопустимая категория расхода")
	ErrInvalidExpenseTitle    = errors.New("укажите название расхода")
	ErrInvalidExpenseAmount   = errors.New("сумма расхода должна быть больше 0")
)

type ArenaExpense struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ArenaID     uint      `gorm:"column:arena_id;not null" json:"arena_id"`
	CreatedBy   *uint     `gorm:"column:created_by" json:"created_by,omitempty"`
	Category    string    `gorm:"column:category;type:varchar(32);not null;default:'other'" json:"category"`
	Title       string    `gorm:"column:title;type:varchar(160);not null" json:"title"`
	Amount      int       `gorm:"column:amount;not null" json:"amount"`
	ExpenseDate string    `gorm:"column:expense_date;type:varchar(20);not null" json:"expense_date"`
	Notes       string    `gorm:"column:notes;type:text;not null;default:''" json:"notes"`
	CreatedAt   time.Time `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at;default:now()" json:"updated_at"`
}

func (ArenaExpense) TableName() string { return "arena_expenses" }

type CreateExpenseRequest struct {
	Category    string `json:"category"`
	Title       string `json:"title"`
	Amount      int    `json:"amount"`
	ExpenseDate string `json:"expense_date"`
	Notes       string `json:"notes"`
}

type HallRevenueItem struct {
	HallID     uint    `json:"hall_id"`
	HallTitle  string  `json:"hall_title"`
	SportType  string  `json:"sport_type"`
	Revenue    int     `json:"revenue"`
	Collected  int     `json:"collected"`
	HoursCount float64 `json:"hours_count"`
}

type ExpenseCategoryItem struct {
	Category string `json:"category"`
	Amount   int    `json:"amount"`
	Count    int    `json:"count"`
}

type FinanceTransactionItem struct {
	ID         uint   `json:"id"`
	ClientName string `json:"client_name"`
	HallTitle  string `json:"hall_title"`
	Amount     int    `json:"amount"`
	PaidAmount int    `json:"paid_amount"`
	Date       string `json:"date"`
	TimeSlot   string `json:"time_slot"`
}

type FinanceReport struct {
	Period                 string                   `json:"period"`
	TotalRevenue           int                      `json:"total_revenue"`
	CollectedAmount        int                      `json:"collected_amount"`
	UnpaidAmount           int                      `json:"unpaid_amount"`
	TotalExpenses          int                      `json:"total_expenses"`
	NetProfit              int                      `json:"net_profit"`
	AccruedProfit          int                      `json:"accrued_profit"`
	ConfirmedBookingsCount int                      `json:"confirmed_bookings_count"`
	HoursPlayed            float64                  `json:"hours_played"`
	AverageCheckPerHour    *int                     `json:"average_check_per_hour"`
	UtilizationRate        int                      `json:"utilization_rate"`
	GrowthPercent          *float64                 `json:"growth_percent"`
	HallRevenues           []HallRevenueItem        `json:"hall_revenues"`
	ExpenseCategories      []ExpenseCategoryItem    `json:"expense_categories"`
	RecentTransactions     []FinanceTransactionItem `json:"recent_transactions"`
	Expenses               []ArenaExpense           `json:"expenses"`
}

func validExpenseCategory(cat string) bool {
	switch cat {
	case "rent", "salary", "utilities", "equipment", "marketing", "other":
		return true
	default:
		return false
	}
}

func (s *Service) CreateExpense(ctx context.Context, arenaID, userID uint, req CreateExpenseRequest) (*ArenaExpense, error) {
	cat := strings.TrimSpace(req.Category)
	if cat == "" {
		cat = "other"
	}
	if !validExpenseCategory(cat) {
		return nil, ErrInvalidExpenseCategory
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, ErrInvalidExpenseTitle
	}
	if utf8.RuneCountInString(title) > 160 {
		title = string([]rune(title)[:160])
	}
	if req.Amount <= 0 {
		return nil, ErrInvalidExpenseAmount
	}
	dateStr := strings.TrimSpace(req.ExpenseDate)
	if dateStr == "" {
		dateStr = time.Now().In(venueTZ).Format("2006-01-02")
	}
	day, err := parseDate(dateStr)
	if err != nil {
		return nil, err
	}
	notes := strings.TrimSpace(req.Notes)
	if utf8.RuneCountInString(notes) > 1000 {
		notes = string([]rune(notes)[:1000])
	}
	uid := userID
	now := time.Now()
	exp := ArenaExpense{
		ArenaID:     arenaID,
		CreatedBy:   &uid,
		Category:    cat,
		Title:       title,
		Amount:      req.Amount,
		ExpenseDate: day.Format("2006-01-02"),
		Notes:       notes,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.db.WithContext(ctx).Create(&exp).Error; err != nil {
		return nil, err
	}
	return &exp, nil
}

func (s *Service) DeleteExpense(ctx context.Context, arenaID, expenseID uint) error {
	res := s.db.WithContext(ctx).Where("id = ? AND arena_id = ?", expenseID, arenaID).Delete(&ArenaExpense{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrExpenseNotFound
	}
	return nil
}

func periodBounds(period string, now time.Time) (norm string, from, to, prevFrom string, days int) {
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, venueTZ)
	tomorrow := today.AddDate(0, 0, 1)
	switch period {
	case "today":
		return "today", today.Format("2006-01-02"), tomorrow.Format("2006-01-02"), today.AddDate(0, 0, -1).Format("2006-01-02"), 1
	case "week":
		start := tomorrow.AddDate(0, 0, -7)
		return "week", start.Format("2006-01-02"), tomorrow.Format("2006-01-02"), start.AddDate(0, 0, -7).Format("2006-01-02"), 7
	case "all":
		return "all", "", "", "", 0
	default:
		start := tomorrow.AddDate(0, 0, -30)
		return "month", start.Format("2006-01-02"), tomorrow.Format("2006-01-02"), start.AddDate(0, 0, -30).Format("2006-01-02"), 30
	}
}

func (s *Service) availableScheduleHours(ctx context.Context, halls []Hall, fromStr string, days int) float64 {
	if days <= 0 || len(halls) == 0 {
		return 0
	}
	startDay, err := parseDate(fromStr)
	if err != nil {
		return float64(len(halls)*days) * 15
	}
	totalMinutes := 0
	for _, h := range halls {
		week, err := s.GetHallSchedule(ctx, h.ID)
		if err != nil {
			totalMinutes += days * 15 * 60
			continue
		}
		byDow := make(map[int]HallScheduleDay, 7)
		for _, d := range week {
			byDow[d.DayOfWeek] = d
		}
		for i := 0; i < days; i++ {
			cur := startDay.AddDate(0, 0, i)
			sched, ok := byDow[int(cur.Weekday())]
			if !ok {
				totalMinutes += 15 * 60
				continue
			}
			if sched.IsClosed {
				continue
			}
			open, e1 := parseClock(sched.StartTime)
			closeMins, e2 := parseClock(sched.EndTime)
			if e1 == nil && e2 == nil && closeMins > open {
				totalMinutes += closeMins - open
			}
		}
	}
	return float64(totalMinutes) / 60.0
}

func (s *Service) GetFinanceReport(ctx context.Context, arenaID uint, period string) (*FinanceReport, error) {
	normPeriod, from, to, prevFrom, days := periodBounds(period, time.Now().In(venueTZ))

	var halls []Hall
	if err := s.db.WithContext(ctx).Where("arena_id = ?", arenaID).Order("id ASC").Find(&halls).Error; err != nil {
		return nil, err
	}

	bq := s.db.WithContext(ctx).Table("bookings").
		Select("bookings.*, halls.title as hall_title, halls.sport_type as sport_type").
		Joins("JOIN halls ON halls.id = bookings.hall_id").
		Where("bookings.arena_id = ? AND bookings.status IN ('confirmed', 'completed')", arenaID)
	if normPeriod != "all" {
		bq = bq.Where("bookings.booking_date >= ? AND bookings.booking_date < ?", from, to)
	}
	var bookings []Booking
	if err := bq.Order("bookings.booking_date DESC, bookings.start_time DESC, bookings.id DESC").Find(&bookings).Error; err != nil {
		return nil, err
	}

	eq := s.db.WithContext(ctx).Where("arena_id = ?", arenaID)
	if normPeriod != "all" {
		eq = eq.Where("expense_date >= ? AND expense_date < ?", from, to)
	}
	var expenses []ArenaExpense
	if err := eq.Order("expense_date DESC, id DESC").Find(&expenses).Error; err != nil {
		return nil, err
	}

	hallMap := make(map[uint]*HallRevenueItem, len(halls))
	hallRevList := make([]HallRevenueItem, 0, len(halls))
	for _, h := range halls {
		hallRevList = append(hallRevList, HallRevenueItem{
			HallID:    h.ID,
			HallTitle: h.Title,
			SportType: h.SportType,
		})
	}
	for i := range hallRevList {
		hallMap[hallRevList[i].HallID] = &hallRevList[i]
	}

	totalRevenue := 0
	collectedAmount := 0
	unpaidAmount := 0
	totalMinutes := 0
	recentTx := make([]FinanceTransactionItem, 0, 10)
	for i, b := range bookings {
		totalRevenue += b.TotalPrice
		collectedAmount += b.PaidAmount
		if b.TotalPrice > b.PaidAmount {
			unpaidAmount += b.TotalPrice - b.PaidAmount
		}
		totalMinutes += b.DurationMinutes
		if hr, ok := hallMap[b.HallID]; ok {
			hr.Revenue += b.TotalPrice
			hr.Collected += b.PaidAmount
			hr.HoursCount += float64(b.DurationMinutes) / 60.0
		}
		if i < 10 {
			recentTx = append(recentTx, FinanceTransactionItem{
				ID:         b.ID,
				ClientName: b.ClientName,
				HallTitle:  b.HallTitle,
				Amount:     b.TotalPrice,
				PaidAmount: b.PaidAmount,
				Date:       b.BookingDate,
				TimeSlot:   b.TimeSlot,
			})
		}
	}
	for i := range hallRevList {
		hallRevList[i].HoursCount = math.Round(hallRevList[i].HoursCount*10) / 10
	}

	totalExpenses := 0
	catMap := make(map[string]*ExpenseCategoryItem)
	for _, e := range expenses {
		totalExpenses += e.Amount
		c, ok := catMap[e.Category]
		if !ok {
			c = &ExpenseCategoryItem{Category: e.Category}
			catMap[e.Category] = c
		}
		c.Amount += e.Amount
		c.Count++
	}
	catOrder := []string{"rent", "salary", "utilities", "equipment", "marketing", "other"}
	catList := make([]ExpenseCategoryItem, 0, len(catMap))
	for _, k := range catOrder {
		if c, ok := catMap[k]; ok {
			catList = append(catList, *c)
		}
	}

	hoursPlayed := math.Round((float64(totalMinutes)/60.0)*10) / 10
	var avgCheck *int
	if hoursPlayed > 0 {
		v := int(math.Round(float64(totalRevenue) / hoursPlayed))
		avgCheck = &v
	}

	availHours := s.availableScheduleHours(ctx, halls, from, days)
	utilRate := 0
	if availHours > 0 {
		utilRate = int(math.Round((float64(totalMinutes) / 60.0 / availHours) * 100))
		if utilRate > 100 {
			utilRate = 100
		}
	}

	var growthPct *float64
	if normPeriod != "all" {
		var prevRevenue int64
		if err := s.db.WithContext(ctx).Table("bookings").
			Select("COALESCE(SUM(total_price), 0)").
			Where("arena_id = ? AND status IN ('confirmed', 'completed') AND booking_date >= ? AND booking_date < ?", arenaID, prevFrom, from).
			Scan(&prevRevenue).Error; err == nil && prevRevenue > 0 {
			pct := math.Round(((float64(totalRevenue)-float64(prevRevenue))/float64(prevRevenue))*1000) / 10
			growthPct = &pct
		}
	}

	return &FinanceReport{
		Period:                 normPeriod,
		TotalRevenue:           totalRevenue,
		CollectedAmount:        collectedAmount,
		UnpaidAmount:           unpaidAmount,
		TotalExpenses:          totalExpenses,
		NetProfit:              collectedAmount - totalExpenses,
		AccruedProfit:          totalRevenue - totalExpenses,
		ConfirmedBookingsCount: len(bookings),
		HoursPlayed:            hoursPlayed,
		AverageCheckPerHour:    avgCheck,
		UtilizationRate:        utilRate,
		GrowthPercent:          growthPct,
		HallRevenues:           hallRevList,
		ExpenseCategories:      catList,
		RecentTransactions:     recentTx,
		Expenses:               expenses,
	}, nil
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

func (h *Handler) GetOwnFinance(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrNoOwnArena) {
			http.Error(w, `{"error":"no business arena for this account"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to resolve arena"}`, http.StatusInternalServerError)
		return
	}
	period := strings.TrimSpace(r.URL.Query().Get("period"))
	report, err := h.service.GetFinanceReport(r.Context(), arenaID, period)
	if err != nil {
		http.Error(w, `{"error":"failed to build finance report"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(report)
}

func (h *Handler) CreateOwnExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
		return
	}
	var req CreateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	exp, err := h.service.CreateExpense(r.Context(), arenaID, userID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{"expense": exp})
}

func (h *Handler) DeleteOwnExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
		return
	}
	expID, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid expense id"}`, http.StatusBadRequest)
		return
	}
	if err := h.service.DeleteExpense(r.Context(), arenaID, uint(expID)); err != nil {
		if errors.Is(err, ErrExpenseNotFound) {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to delete expense"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
