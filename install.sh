#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  printf '%s\n' 'Utilizare: bash install.sh' \
    'Pregătește intraNOT pe Debian. Folosește Node.js >=22 dacă există deja.' \
    'Altfel descarcă Node.js 24 din nodejs.org în .local/node/, cu verificare SHA-256.' \
    'Nu instalează aplicația ca serviciu și nu modifică firewall-ul.'
  exit 0
fi
if [[ $# -ne 0 ]]; then printf 'Argument necunoscut. Folosește --help.\n' >&2; exit 1; fi
if [[ "$(uname -s)" != 'Linux' || ! -f /etc/debian_version ]]; then
  printf 'Acest script este destinat Debian și distribuțiilor bazate pe Debian.\n' >&2
  exit 1
fi

usable_node() {
  [[ -x "$1" ]] && "$1" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' >/dev/null 2>&1
}

node_bin=''
if usable_node "$project_root/.local/node/current/bin/node"; then
  node_bin="$project_root/.local/node/current/bin/node"
elif command -v node >/dev/null 2>&1 && usable_node "$(command -v node)"; then
  node_bin="$(command -v node)"
else
  case "$(uname -m)" in
    x86_64|amd64) node_arch='x64' ;;
    aarch64|arm64) node_arch='arm64' ;;
    *) printf 'Arhitectură nesuportată automat. Instalează Node.js >=22 și rulează din nou.\n' >&2; exit 1 ;;
  esac

  missing=0
  for tool in curl tar xz sha256sum; do command -v "$tool" >/dev/null 2>&1 || missing=1; done
  if [[ "$missing" -eq 1 ]]; then
    printf 'Se instalează utilitarele necesare descărcării Node.js.\n'
    if [[ "$EUID" -eq 0 ]]; then apt_runner=();
    elif command -v sudo >/dev/null 2>&1; then apt_runner=(sudo);
    else printf 'Instalează ca administrator: apt-get install ca-certificates curl tar xz-utils coreutils\n' >&2; exit 1; fi
    "${apt_runner[@]}" apt-get update
    "${apt_runner[@]}" apt-get install -y ca-certificates curl tar xz-utils coreutils
  fi

  mkdir -p "$project_root/.local/node"
  download_dir="$(mktemp -d "$project_root/.local/node/download.XXXXXX")"
  trap 'rm -rf -- "$download_dir"' EXIT
  node_base='https://nodejs.org/dist/latest-v24.x'
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --connect-timeout 15 --max-time 120 "$node_base/SHASUMS256.txt" -o "$download_dir/SHASUMS256.txt"
  checksum_line="$(awk -v suffix="-linux-$node_arch.tar.xz" 'index($2,suffix) && substr($2,length($2)-length(suffix)+1)==suffix { print; exit }' "$download_dir/SHASUMS256.txt")"
  read -r expected_sum archive_name <<< "$checksum_line"
  if [[ ! "${expected_sum:-}" =~ ^[a-f0-9]{64}$ || ! "${archive_name:-}" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]]; then
    printf 'Lista de versiuni Node.js nu conține o arhivă validă pentru sistem.\n' >&2; exit 1
  fi
  printf 'Se descarcă %s din sursa oficială Node.js…\n' "$archive_name"
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --connect-timeout 15 --max-time 600 "$node_base/$archive_name" -o "$download_dir/$archive_name"
  (cd "$download_dir" && printf '%s  %s\n' "$expected_sum" "$archive_name" | sha256sum --check --status -)
  node_folder="${archive_name%.tar.xz}"
  tar -xJf "$download_dir/$archive_name" -C "$download_dir"
  if [[ ! -e "$project_root/.local/node/$node_folder" ]]; then
    mv -- "$download_dir/$node_folder" "$project_root/.local/node/$node_folder"
  fi
  if [[ -e "$project_root/.local/node/current" && ! -L "$project_root/.local/node/current" ]]; then
    printf 'Calea .local/node/current există și nu este un link; nu va fi înlocuită.\n' >&2; exit 1
  fi
  ln -sfn -- "$node_folder" "$project_root/.local/node/current"
  node_bin="$project_root/.local/node/current/bin/node"
  if ! usable_node "$node_bin"; then printf 'Runtime-ul Node.js nu poate porni pe acest sistem.\n' >&2; exit 1; fi
fi

printf 'Node.js: %s\n' "$("$node_bin" --version)"
mkdir -p "$project_root/.local"
printf '%s\n' "$node_bin" > "$project_root/.local/node-path"
for source in orar/server.cjs orar/dist/app.js orar/dist/schedule.mjs orar/dist/pdf-reader.mjs orar/dist/discipline-names.mjs; do
  "$node_bin" --check "$project_root/$source"
done
"$node_bin" --test "$project_root/orar/tests/schedule.test.mjs" "$project_root/orar/tests/server.test.cjs"
chmod u+x "$project_root/start.sh"
printf '\nInstalare pregătită. Pornește cu:\n  cd %q\n  ./start.sh\n\n' "$project_root"
printf '%s\n' 'În LAN: http://IP-UL-SERVERULUI:4173 (IP-ul este afișat la pornire).' \
  'PDF-urile se încarcă din interfață și nu sunt incluse în repository.'
