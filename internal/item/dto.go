package item

import "encoding/json"

type CreateItemRequest struct {
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Category    string          `json:"category"`
	Status      string          `json:"status"`
	ImageURL    string          `json:"image_url"`
	Metadata    json.RawMessage `json:"metadata"`
}

type UpdateItemRequest struct {
	Title       *string          `json:"title"`
	Description *string          `json:"description"`
	Category    *string          `json:"category"`
	Status      *string          `json:"status"`
	ImageURL    *string          `json:"image_url"`
	Metadata    *json.RawMessage `json:"metadata"`
}

type ListFilter struct {
	Category string
	Status   string
	Search   string
	UserID   uint
	Page     int
	PageSize int
}

type PaginatedResponse struct {
	Items    []Item `json:"items"`
	Total    int64  `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}
