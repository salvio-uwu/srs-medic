#!/bin/bash

# ==========================================
# Configuración de entorno y colores ANSI
# ==========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ==========================================
# Funciones auxiliares
# ==========================================

# Animación de carga en consola
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# ==========================================
# Ejecución principal
# ==========================================

clear
echo -e "${BOLD}${CYAN}=== SRS Medic | CI/CD Release Pipeline ===${NC}\n"

# 1. Validar dependencia de Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js es requerido para leer el package.json.${NC}"
    exit 1
fi

# 2. Extraer versión actual
VERSION=$(node -p "require('./package.json').version")
echo -e "Versión objetivo: ${BOLD}${YELLOW}v${VERSION}${NC}\n"

# 3. Confirmación de seguridad
read -p "Deseas iniciar el despliegue a GitHub Actions? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${RED}Operación cancelada por el usuario.${NC}"
    exit 1
fi
echo ""

# 4. Sincronización de código base
echo -e "${BLUE}[1/3] Analizando árbol de trabajo...${NC}"
if [[ -n $(git status -s) ]]; then
    git add .
    # Se usa nomenclatura de commits semánticos
    git commit -m "chore(release): empaquetar versión v${VERSION}" > /dev/null
    
    echo -n -e "${BLUE}      Empujando cambios a 'main'...${NC}"
    git push origin main &> /dev/null &
    spinner $!
    echo -e "\n"
else
    echo -e "${YELLOW}      Árbol limpio. Omitiendo commit.${NC}\n"
fi

# 5. Gestión de Tags
echo -n -e "${BLUE}[2/3] Generando tag de versión (v${VERSION})...${NC}"
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
    echo -e "\n${YELLOW}      Advertencia: El tag v${VERSION} ya existe localmente.${NC}"
else
    git tag -a "v${VERSION}" -m "Release oficial v${VERSION}"
    echo -e " Hecho."
fi

# 6. Disparar Pipeline
echo -n -e "${BLUE}[3/3] Disparando GitHub Actions...${NC}"
git push origin "v${VERSION}" &> /dev/null &
spinner $!
echo -e "\n"

# 7. Finalización y métricas
REPO_URL=$(git config --get remote.origin.url | sed -e 's/git@github.com:/https:\/\/github.com\//' -e 's/\.git//')

echo -e "${BOLD}${GREEN}Despliegue iniciado correctamente.${NC}"
echo -e "Monitorea la compilación de los binarios en:"
echo -e "${CYAN}${REPO_URL}/actions${NC}\n"
