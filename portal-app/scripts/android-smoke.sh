#!/usr/bin/env bash
set -euo pipefail
APP_VERSION=$(node -p "require('./portal-app/app.json').expo.version")
APK="android-artifact/Camila-Martins-Engenharia-${APP_VERSION}-pre-sign.apk"
PACKAGE=br.com.camilamartinsengenharia.app
UI_XML="android-artifact/startup-ui.xml"
LOGCAT="android-artifact/startup-logcat.txt"

adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PACKAGE/.MainActivity"

# O AVD do GitHub pode exibir um ANR do próprio launcher Quickstep durante o
# primeiro boot. Isso não é falha do aplicativo. Quando (e somente quando)
# esse diálogo específico do sistema aparecer, toque em "Wait" e continue a
# validar a interface do nosso pacote. ANR/crash do app continua reprovando.
dismiss_quickstep_anr_if_present() {
  if ! grep -q "Quickstep isn't responding" "$UI_XML" 2>/dev/null; then
    return 0
  fi

  local tap
  tap=$(python3 - "$UI_XML" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
try:
    root = ET.parse(path).getroot()
except Exception:
    raise SystemExit(0)

has_quickstep = any(
    node.attrib.get('text') == "Quickstep isn't responding"
    and node.attrib.get('package') == 'android'
    for node in root.iter('node')
)
if not has_quickstep:
    raise SystemExit(0)

for node in root.iter('node'):
    if node.attrib.get('resource-id') != 'android:id/aerr_wait':
        continue
    match = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds', ''))
    if match:
        x1, y1, x2, y2 = map(int, match.groups())
        print(f'{(x1 + x2) // 2} {(y1 + y2) // 2}')
        break
PY
  )

  if [[ -n "$tap" ]]; then
    read -r x y <<<"$tap"
    echo "INFO: dispensando ANR do launcher Quickstep do emulador em ${x},${y}."
    adb shell input tap "$x" "$y"
    sleep 2
  fi
}

login_rendered=false
for attempt in $(seq 1 12); do
  sleep 5
  adb shell uiautomator dump /sdcard/cme-ui.xml >/dev/null
  adb pull /sdcard/cme-ui.xml "$UI_XML" >/dev/null

  dismiss_quickstep_anr_if_present

  # Se um diálogo do sistema foi dispensado, capture novamente a tela real.
  if grep -q "Quickstep isn't responding" "$UI_XML" 2>/dev/null; then
    adb shell uiautomator dump /sdcard/cme-ui.xml >/dev/null
    adb pull /sdcard/cme-ui.xml "$UI_XML" >/dev/null
  fi

  if grep -q 'Entrar' "$UI_XML" && grep -qi 'senha' "$UI_XML"; then
    login_rendered=true
    break
  fi
done

adb logcat -d > "$LOGCAT"
adb exec-out screencap -p > android-artifact/startup.png

test -n "$(adb shell pidof "$PACKAGE")"

# Reprova somente se houver evidência de falha nativa do nosso processo.
if grep -A12 -B4 -E 'FATAL EXCEPTION|ANR in' "$LOGCAT" | grep -q "$PACKAGE"; then
  echo 'Falha nativa/ANR do aplicativo na inicialização.'
  exit 1
fi

if [[ "$login_rendered" != true ]]; then
  echo 'O processo abriu, mas o formulário de login não ficou acessível ao teste.'
  exit 1
fi

grep -q 'Entrar' "$UI_XML"
grep -qi 'senha' "$UI_XML"
echo 'PASS: APK instalado, processo ativo e formulário de login renderizado no Android.'
