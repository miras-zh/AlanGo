#!/bin/bash
set -e

# ==============================================================================
# AlanGo — Скрипт сборки для TestFlight (версия 1.0.0, билд 6)
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "========================================================"
echo "🚀 Подготовка и сборка AlanGo для Apple TestFlight"
echo "Версия: 1.0.0"
echo "Build:   6"
echo "Bundle ID: kz.alango.app"
echo "========================================================"

echo ""
echo "Выберите метод сборки:"
echo "1) EAS Build (Облачная сборка Expo -> автоматическая отправка в TestFlight)"
echo "2) Локальная сборка Xcode Release Archive (.xcarchive на этом Mac)"
echo "3) Только проверка экспорта производственного JS-бандла (Dry-run)"
echo ""
read -p "Введите номер (1, 2 или 3, по умолчанию 1): " BUILD_CHOICE
BUILD_CHOICE=${BUILD_CHOICE:-1}

if [ "$BUILD_CHOICE" == "1" ]; then
    echo "📦 Запуск сборки через Expo Application Services (EAS Build)..."
    if ! command -v eas &> /dev/null; then
        echo "ℹ️  Используется npx eas-cli..."
        npx --yes eas-cli build --platform ios --profile production --auto-submit
    else
        eas build --platform ios --profile production --auto-submit
    fi

elif [ "$BUILD_CHOICE" == "2" ]; then
    echo "⚙️  Сборка нативного архива через Xcode..."
    ARCHIVE_PATH="$PROJECT_DIR/ios/build/AlanGo_v1.0.0_b6.xcarchive"
    mkdir -p "$PROJECT_DIR/ios/build"

    xcodebuild -workspace ios/AlanGo.xcworkspace \
               -scheme AlanGo \
               -configuration Release \
               -destination "generic/platform=iOS" \
               -archivePath "$ARCHIVE_PATH" \
               archive

    echo "✅ Архив успешно создан: $ARCHIVE_PATH"
    echo "Для загрузки в TestFlight откройте Xcode Organizer (Window -> Organizer) или приложение Apple Transporter."

elif [ "$BUILD_CHOICE" == "3" ]; then
    echo "🔍 Проверка производственного JS-бандла..."
    npx expo export --platform ios
    echo "✅ Экспорт бандла завершен без ошибок! Проект полностью готов к TestFlight."
fi

