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

# 1. Validar dependencias
if ! command -v node &> /dev/null; then
    echo -e "${RED}[!] Error: Node.js es requerido.${NC}"
    exit 1
fi

# 2. Extraer versión actual
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "Versión actual detectada: ${BOLD}${CYAN}v${CURRENT_VERSION}${NC}\n"

# 3. Menú interactivo de versionamiento (SemVer)
echo -e "${BLUE}Selecciona el tipo de actualización para el package.json:${NC}"
echo "  1) Patch (Corrección de bugs)       -> Incrementa a $(npm --no-git-tag-version version patch --dry-run 2>/dev/null | sed 's/v//')"
echo "  2) Minor (Nuevas características)   -> Incrementa a $(npm --no-git-tag-version version minor --dry-run 2>/dev/null | sed 's/v//')"
echo "  3) Major (Cambios incompatibles)    -> Incrementa a $(npm --no-git-tag-version version major --dry-run 2>/dev/null | sed 's/v//')"
echo "  4) Ninguna (Mantener v${CURRENT_VERSION} para reintentar pipeline)"
echo ""
read -p "Opción [1-4]: " BUMP_OPT

echo ""

case $BUMP_OPT in
    1) npm version patch --no-git-tag-version > /dev/null ;;
    2) npm version minor --no-git-tag-version > /dev/null ;;
    3) npm version major --no-git-tag-version > /dev/null ;;
    4) echo -e "${YELLOW}[i] Manteniendo versión actual.${NC}" ;;
    *) echo -e "${RED}[!] Opción inválida. Abortando.${NC}"; exit 1 ;;
esac

# Obtener la versión final que se va a desplegar
VERSION=$(node -p "require('./package.json').version")

if [ "$CURRENT_VERSION" != "$VERSION" ]; then
    echo -e "${GREEN}[✔] Versión actualizada a v${VERSION}${NC}\n"
fi

# 4. Confirmación de seguridad
read -p "¿Deseas iniciar el despliegue de la versión v${VERSION} a GitHub Actions? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${RED}Operación cancelada por el usuario.${NC}"
    # Si cancela, revertimos el cambio en el package.json por limpieza
    git restore package.json package-lock.json 2>/dev/null
    exit 1
fi
echo ""

# 5. Sincronización de código base
echo -e "${BLUE}[1/3] Analizando árbol de trabajo...${NC}"
if [[ -n $(git status -s) ]]; then
    git add .
    git commit -m "chore(release): empaquetar versión v${VERSION}" > /dev/null
    
    echo -n -e "${BLUE}      Empujando código a la rama 'main'...${NC}"
    git push origin main &> /dev/null &
    spinner $!
    echo -e "\n"
else
    echo -e "${YELLOW}      Árbol limpio (sin contar package.json si no hubo bump).${NC}\n"
fi

# 6. Gestión de Tags
echo -n -e "${BLUE}[2/3] Generando tag de versión (v${VERSION})...${NC}"
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
    echo -e "\n${YELLOW}      Advertencia: El tag v${VERSION} ya existe localmente.${NC}"
else
    git tag -a "v${VERSION}" -m "Release oficial v${VERSION}"
    echo -e " [✔]"
fi

# 7. Disparar Pipeline
echo -n -e "${BLUE}[3/3] Disparando GitHub Actions...${NC}"
git push origin "v${VERSION}" &> /dev/null &
spinner $!
echo -e "\n"

# 8. Finalización y enlaces
REPO_URL=$(git config --get remote.origin.url | sed -e 's/git@github.com:/https:\/\/github.com\//' -e 's/\.git//')

echo -e "${BOLD}${GREEN}[✔] Despliegue iniciado correctamente.${NC}"
echo -e "Monitorea la compilación de los binarios nativos en:"
echo -e "${CYAN}${REPO_URL}/actions${NC}\n"
