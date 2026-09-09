#!/usr/bin/env bash
set -euo pipefail
APP_VERSION=$(node -p "require('./portal-app/app.json').expo.version")
APK="android-artifact/Camila-Martins-Engenharia-${APP_VERSION}-pre-sign.apk"
PACKAGE=br.com.camilamartinsengenharia.app
adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PACKAGE/.MainActivity"
for attempt in $(seq 1 12); do
  sleep 5
  adb shell uiautomator dump /sdcard/cme-ui.xml >/dev/null
  adb pull /sdcard/cme-ui.xml android-artifact/startup-ui.xml >/dev/null
  if grep -q 'Entrar' android-artifact/startup-ui.xml; then break; fi
done
adb logcat -d > android-artifact/startup-logcat.txt
adb exec-out screencap -p > android-artifact/startup.png
test -n "$(adb shell pidof "$PACKAGE")"
if grep -q 'FATAL EXCEPTION' android-artifact/startup-logcat.txt; then
  echo 'Falha nativa na inicialização.'
  exit 1
fi
grep -q 'Entrar' android-artifact/startup-ui.xml
grep -qi 'senha' android-artifact/startup-ui.xml
echo 'PASS: APK instalado, processo ativo e formulário de login renderizado no Android.'

