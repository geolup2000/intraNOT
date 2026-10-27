#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
service_user="${SUDO_USER:-$(id -un)}"
print_only=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) [[ $# -ge 2 ]] || { printf 'Lipsește utilizatorul după --user.\n' >&2; exit 1; }; service_user="$2"; shift 2 ;;
    --print-unit) print_only=1; shift ;;
    --help|-h)
      printf '%s\n' 'Utilizare: sudo bash install-service.sh [--user UTILIZATOR]' \
        'Creează serviciul intranot.service și activează pornirea la boot.' \
        'Rulează mai întâi bash install.sh din contul care va rula aplicația.' \
        'Pentru previzualizare fără instalare: bash install-service.sh --user UTILIZATOR --print-unit'
      exit 0 ;;
    *) printf 'Argument necunoscut: %s\n' "$1" >&2; exit 1 ;;
  esac
done

if [[ "$(uname -s)" != 'Linux' ]]; then printf 'Serviciul systemd este destinat Linux.\n' >&2; exit 1; fi
if [[ -z "$service_user" || ! "$service_user" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*\$?$ ]]; then
  printf 'Alege un utilizator valid: bash install-service.sh --user NUME_UTILIZATOR\n' >&2; exit 1
fi
if ! id "$service_user" >/dev/null 2>&1; then printf 'Utilizatorul %s nu există.\n' "$service_user" >&2; exit 1; fi
if [[ "$project_root" == *$'\n'* || "$project_root" == *$'\r'* ]]; then printf 'Calea proiectului nu poate conține linii noi.\n' >&2; exit 1; fi

# Quote paths for systemd, including percent signs (specifier escaping).
unit_root="${project_root//\\/\\\\}"
unit_root="${unit_root//\"/\\\"}"
unit_root="${unit_root//%/%%}"
service_group="$(id -gn "$service_user")"
make_unit() {
  cat <<EOF
# Managed by intraNOT install-service.sh
[Unit]
Description=intraNOT - Orar universitar in LAN
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$service_user
Group=$service_group
WorkingDirectory=$unit_root
ExecStart=/usr/bin/bash "$unit_root/start.sh"
Environment=INTRANOT_HOST=0.0.0.0
Environment=INTRANOT_PORT=4173
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF
}

if [[ "$print_only" -eq 1 ]]; then make_unit; exit 0; fi
if [[ "$EUID" -ne 0 ]]; then printf 'Rulează cu sudo pentru a instala serviciul systemd.\n' >&2; exit 1; fi
if [[ ! -d /run/systemd/system ]]; then printf 'Acest sistem nu rulează cu systemd.\n' >&2; exit 1; fi
for tool in systemctl runuser install; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'Utilitar necesar lipsă: %s\n' "$tool" >&2; exit 1; }
done
if ! runuser -u "$service_user" -- /usr/bin/bash "$project_root/start.sh" --check; then
  printf 'Contul %s nu poate citi proiectul sau Node.js lipsește. Rulează mai întâi bash install.sh din acel cont.\n' "$service_user" >&2; exit 1
fi

unit_file='/etc/systemd/system/intranot.service'
if [[ -e "$unit_file" ]]; then
  if ! grep -Fxq '# Managed by intraNOT install-service.sh' "$unit_file"; then
    printf 'Există deja un serviciu intranot.service care nu este gestionat de acest script. Nu va fi suprascris.\n' >&2; exit 1
  fi
  mkdir -p "$project_root/.local/backups"
  cp -- "$unit_file" "$project_root/.local/backups/intranot.service.$(date +%Y%m%d-%H%M%S)"
fi
temporary_unit="$(mktemp)"
trap 'rm -f -- "$temporary_unit"' EXIT
make_unit > "$temporary_unit"
install -m 644 "$temporary_unit" "$unit_file"
systemctl daemon-reload
systemctl enable intranot.service
systemctl restart intranot.service
if ! systemctl is-active --quiet intranot.service; then
  systemctl status intranot.service --no-pager || true
  printf 'Serviciul nu a pornit. Verifică dacă portul 4173 este deja folosit.\n' >&2; exit 1
fi
printf '%s\n' 'Serviciul intraNOT este activ și va porni automat la boot.' \
  'Stare: sudo systemctl status intranot' \
  'Loguri: sudo journalctl -u intranot -n 50 --no-pager'
