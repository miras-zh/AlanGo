package upload

import (
	"fmt"
	"os"
)

// StorageConfig описывает настройки хранилища файлов:
// - local: локальная папка ./uploads (по умолчанию)
// - s3:    MinIO или AWS S3 / Cloudflare R2 / DigitalOcean Spaces
type StorageConfig struct {
	Driver    string // "local" | "s3"
	Endpoint  string // например "http://localhost:9000" для MinIO
	Region    string // например "us-east-1"
	Bucket    string // например "alango-uploads"
	AccessKey string
	SecretKey string
	PublicURL string // например "http://localhost:9000/alango-uploads"
}

func LoadStorageConfigFromEnv() StorageConfig {
	driver := os.Getenv("STORAGE_DRIVER")
	if driver == "" {
		driver = "local"
	}
	return StorageConfig{
		Driver:    driver,
		Endpoint:  os.Getenv("S3_ENDPOINT"),
		Region:    os.Getenv("S3_REGION"),
		Bucket:    os.Getenv("S3_BUCKET"),
		AccessKey: os.Getenv("S3_ACCESS_KEY"),
		SecretKey: os.Getenv("S3_SECRET_KEY"),
		PublicURL: os.Getenv("S3_PUBLIC_URL"),
	}
}

// BuildPublicObjectURL возвращает публичный URL для загруженного объекта в MinIO/S3.
// Примеры использования MinIO/S3 в будущих функциях приложения:
// 1. Хранение пользовательских аватаров и галерей изображений (без переполнения диска сервера)
// 2. Хранение PDF-чеков, сгенерированных отчётов и экспорта данных пользователя (GDPR export)
// 3. Хранение аудио/видео вложений, голосовых заметок и резервных копий БД
func (c StorageConfig) BuildPublicObjectURL(objectKey string) string {
	if c.PublicURL != "" {
		return fmt.Sprintf("%s/%s", c.PublicURL, objectKey)
	}
	if c.Endpoint != "" && c.Bucket != "" {
		return fmt.Sprintf("%s/%s/%s", c.Endpoint, c.Bucket, objectKey)
	}
	return "/uploads/" + objectKey
}
