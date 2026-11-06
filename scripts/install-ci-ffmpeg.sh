#!/usr/bin/env bash
set -euo pipefail

if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -version
  exit 0
fi

# Use the signed Ubuntu archives directly. The runner's Azure mirror can
# stall large codec downloads even while the Ubuntu archives remain healthy.
. /etc/os-release
if [[ "${ID:-}" != ubuntu || ! "${VERSION_CODENAME:-}" =~ ^[a-z]+$ ]]; then
  echo 'This installer requires an Ubuntu CI runner.' >&2
  exit 1
fi
keyring=/usr/share/keyrings/ubuntu-archive-keyring.gpg
test -r "$keyring"
cme_sources=$(mktemp "${RUNNER_TEMP:-/tmp}/cme-ffmpeg-XXXXXX.list")
trap 'rm -f "$cme_sources"' EXIT
cat > "$cme_sources" <<EOF
deb [signed-by=$keyring] https://archive.ubuntu.com/ubuntu $VERSION_CODENAME main universe
deb [signed-by=$keyring] https://archive.ubuntu.com/ubuntu $VERSION_CODENAME-updates main universe
deb [signed-by=$keyring] https://security.ubuntu.com/ubuntu $VERSION_CODENAME-security main universe
EOF
cme_apt_options=(
  -o "Dir::Etc::sourcelist=$cme_sources" -o Dir::Etc::sourceparts=-
  -o APT::Get::List-Cleanup=0 -o Acquire::Retries=3
  -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30
)
sudo timeout 180s apt-get "${cme_apt_options[@]}" update -qq
sudo timeout 300s apt-get "${cme_apt_options[@]}" install -y --no-install-recommends ffmpeg
ffmpeg -version
