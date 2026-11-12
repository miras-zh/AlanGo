package user

import (
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrGoogleAlreadyLinked = errors.New("this google account is already linked to another user")
	ErrAppleAlreadyLinked  = errors.New("this apple account is already linked to another user")
	ErrAppleNoEmail        = errors.New("apple token did not include an email for a new account")
	ErrAppleNameRequired   = errors.New("full_name is required when creating an account with apple")
)

type UserService struct {
	DB *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{DB: db}
}

func (s *UserService) CreateUser(user *User) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.Password = string(hashedPassword)
	user.Role = "client"

	res := s.DB.Where("email = ?", user.Email).FirstOrCreate(user)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("email already registered")
	}
	return nil
}

func (s *UserService) createUserWithHashedPassword(user *User) error {
	user.Role = "client"

	res := s.DB.Where("email = ?", user.Email).FirstOrCreate(user)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("email already registered")
	}
	return nil
}

func (s *UserService) GetUserByEmail(email string) (*User, error) {
	var user User
	err := s.DB.Where("LOWER(email) = LOWER(?)", strings.TrimSpace(email)).First(&user).Error
	return &user, err
}

func (s *UserService) GetUserByID(id uint) (*User, error) {
	var user User
	err := s.DB.First(&user, id).Error
	return &user, err
}

func (s *UserService) FindOrCreateByGoogle(sub, email, name, picture string) (*User, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	var u User
	err := s.DB.Where("google_sub = ?", sub).First(&u).Error
	if err == nil {
		return &u, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	err = s.DB.Where("LOWER(email) = LOWER(?)", email).First(&u).Error
	if err == nil {
		if u.GoogleSub != nil && *u.GoogleSub != sub {
			return nil, ErrGoogleAlreadyLinked
		}
		updates := map[string]any{"google_sub": sub}
		if u.Photo == "" && picture != "" {
			updates["photo"] = picture
		}
		if err := s.DB.Model(&u).Updates(updates).Error; err != nil {
			return nil, err
		}
		u.GoogleSub = &sub
		if u.Photo == "" && picture != "" {
			u.Photo = picture
		}
		return &u, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	fullName := strings.TrimSpace(name)
	if fullName == "" {
		fullName, _, _ = strings.Cut(email, "@")
	}
	newUser := User{
		FullName:  fullName,
		Email:     email,
		Photo:     picture,
		GoogleSub: &sub,
		Role:      "client",
	}
	if err := s.DB.Create(&newUser).Error; err != nil {
		return nil, err
	}
	return &newUser, nil
}

func (s *UserService) FindOrCreateByApple(sub, email, name string, emailVerified, isPrivateEmail bool) (*User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)

	var u User
	err := s.DB.Where("apple_sub = ?", sub).First(&u).Error
	if err == nil {
		return &u, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if email != "" && emailVerified && !isPrivateEmail {
		err = s.DB.Where("LOWER(email) = LOWER(?)", email).First(&u).Error
		if err == nil {
			if u.AppleSub != nil && *u.AppleSub != sub {
				return nil, ErrAppleAlreadyLinked
			}
			if err := s.DB.Model(&u).Update("apple_sub", sub).Error; err != nil {
				return nil, err
			}
			u.AppleSub = &sub
			return &u, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if email == "" {
		return nil, ErrAppleNoEmail
	}
	if name == "" {
		if idx := strings.Index(email, "@"); idx > 0 {
			name = strings.Title(email[:idx])
		} else {
			name = "Пользователь Apple"
		}
	}
	newUser := User{
		FullName: name,
		Email:    email,
		AppleSub: &sub,
		Role:     "client",
	}
	if err := s.DB.Create(&newUser).Error; err != nil {
		return nil, err
	}
	return &newUser, nil
}

func (s *UserService) SaveAppleRefreshToken(userID uint, refreshToken string) error {
	return s.DB.Model(&User{}).Where("id = ?", userID).Update("apple_refresh_token", refreshToken).Error
}

func (s *UserService) IsActive(userID uint) (bool, error) {
	var active bool
	err := s.DB.Model(&User{}).Select("active").Where("id = ?", userID).Scan(&active).Error
	return active, err
}

func (s *UserService) GetRoleByID(userID uint) (string, error) {
	var role string
	err := s.DB.Model(&User{}).Select("role").Where("id = ?", userID).Scan(&role).Error
	return role, err
}

func (s *UserService) GetTypeByID(userID uint) (string, error) {
	var userType string
	err := s.DB.Model(&User{}).Select("type").Where("id = ?", userID).Scan(&userType).Error
	return userType, err
}

func (s *UserService) SetPassword(userID uint, plainPassword string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.DB.Model(&User{}).Where("id = ?", userID).Update("password", string(hashed)).Error
}

func (s *UserService) SetPushToken(userID uint, token string) error {
	return s.DB.Transaction(func(tx *gorm.DB) error {
		if token != "" {
			if err := tx.Model(&User{}).
				Where("push_token = ? AND id <> ?", token, userID).
				Update("push_token", "").Error; err != nil {
				return err
			}
		}
		return tx.Model(&User{}).Where("id = ?", userID).Update("push_token", token).Error
	})
}

func (s *UserService) UpdateProfile(id uint, req *UpdateProfileRequest) (*User, error) {
	user, err := s.GetUserByID(id)
	if err != nil {
		return nil, err
	}

	updates := map[string]any{}
	if req.FullName != nil {
		updates["full_name"] = *req.FullName
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
		if *req.Phone != user.Phone {
			updates["phone_verified"] = false
		}
	}
	if req.City != nil {
		updates["city"] = *req.City
	}
	if req.Photo != nil {
		updates["photo"] = *req.Photo
	}

	if len(updates) > 0 {
		if err := s.DB.Model(user).Updates(updates).Error; err != nil {
			return nil, err
		}
	}

	return s.GetUserByID(id)
}

func (s *UserService) DeleteAccount(userID uint) (*User, []string, error) {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return nil, nil, err
	}

	var uploadedURLs []string
	if user.Photo != "" {
		uploadedURLs = append(uploadedURLs, user.Photo)
	}

	var itemImages []string
	_ = s.DB.Table("items").
		Where("user_id = ? AND image_url <> ''", userID).
		Pluck("image_url", &itemImages).Error
	uploadedURLs = append(uploadedURLs, itemImages...)

	if err := s.DB.Delete(&User{}, userID).Error; err != nil {
		return nil, nil, err
	}

	return user, uploadedURLs, nil
}
