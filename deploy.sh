#!/bin/bash

# ==============================================================================
# CONFIGURACIÓN DEL DESPLIEGUE
# ==============================================================================
SERVIDORES=("100.122.4.91" "100.122.11.120" "100.95.63.70" "100.119.224.75")
USUARIO="prometeo"
RUTA_DESTINO="/home/prometeo/srs-medic"

# Logs fuera del proyecto para no contaminar el repositorio.
OS_NAME="$(uname -s)"
if [ "$OS_NAME" = "Darwin" ]; then
    LOG_DIR_DEFAULT="$HOME/Library/Logs/srs-medic/deploy"
elif [ "$OS_NAME" = "Linux" ]; then
    # Linux: usar /var/log si el usuario tiene permiso; de lo contrario, estado local por usuario.
    if [ -d "/var/log" ] && [ -w "/var/log" ]; then
        LOG_DIR_DEFAULT="/var/log/srs-medic"
    else
        LOG_DIR_DEFAULT="${XDG_STATE_HOME:-$HOME/.local/state}/srs-medic/deploy"
    fi
else
    LOG_DIR_DEFAULT="$HOME/.srs-medic/logs"
fi

LOG_DIR="${SRS_MEDIC_LOG_DIR:-$LOG_DIR_DEFAULT}"
if ! mkdir -p "$LOG_DIR" 2>/dev/null; then
    LOG_DIR="/tmp/srs-medic-logs"
    mkdir -p "$LOG_DIR"
fi

LOG_FILE="$LOG_DIR/deploy_$(date +%Y%m%d_%H%M%S).log"

# ==============================================================================
# CÓDIGOS DE COLOR Y FORMATO
# ==============================================================================
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
ITALIC='\033[3m'

# Colores (256-color para mayor riqueza visual)
RED='\033[38;5;204m'
GREEN='\033[38;5;114m'
YELLOW='\033[38;5;221m'
BLUE='\033[38;5;75m'
CYAN='\033[38;5;116m'
WHITE='\033[97m'
MAGENTA='\033[38;5;183m'

# Gradiente de acento (azul → cian)
GR1='\033[38;5;27m'
GR2='\033[38;5;33m'
GR3='\033[38;5;39m'
GR4='\033[38;5;45m'
GR5='\033[38;5;81m'
GR6='\033[38;5;123m'

# Fondos
BG_BLUE_FG_WHITE='\033[48;5;25;97m'
BG_GREEN_FG_WHITE='\033[48;5;29;97m'
BG_RED_FG_WHITE='\033[48;5;124;97m'
BG_DARK='\033[48;5;236m'

# Símbolos Unicode
SYM_OK="✔"
SYM_FAIL="✘"
SYM_SKIP="⊘"
SYM_PEND="◌"
SYM_ARROW="▶"
SYM_DOT="●"
SYM_DIAMOND="◈"
SYM_MEDICAL="⚕"
SYM_BULLET="▸"

# Bloques para barras de progreso
BAR_FULL="━"
BAR_EMPTY="╌"

# Spinner braille
BRAILLE=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

# +1 por el build local, +2 por cada nodo (rsync + docker)
TOTAL_STEPS=$(( 1 + ${#SERVIDORES[@]} * 2 ))
STEPS_COMPLETADOS=0

declare -a RESULTADOS_NODO
declare -a DURACION_NODO
declare -a RESULTADOS_SYNC_NODO
declare -a RESULTADOS_DOCKER_NODO

# ==============================================================================
# FUNCIONES AUXILIARES
# ==============================================================================

# Control del cursor para evitar que quede oculto si el usuario cancela (Ctrl+C)
cursor_hide() { printf "\033[?25l"; }
cursor_show() { printf "\033[?25h"; }
trap cursor_show EXIT

timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

formatear_duracion() {
    local total_segundos="${1:-0}"
    local minutos=$((total_segundos / 60))
    local segundos=$((total_segundos % 60))
    printf '%02d:%02d' "$minutos" "$segundos"
}

hline() {
    # ya no se usa como separador visual
    echo
}

tabla_hline() {
    # deprecated - tabla sin bordes
    :
}

estado_color() {
    local estado="$1"
    case "$estado" in
        OK)   printf '%b' "${GREEN}${SYM_OK} OK${RESET}" ;;
        FAIL) printf '%b' "${RED}${SYM_FAIL} FAIL${RESET}" ;;
        SKIP) printf '%b' "${YELLOW}${SYM_SKIP} SKIP${RESET}" ;;
        PEND) printf '%b' "${DIM}${SYM_PEND} --${RESET}" ;;
        *)    printf '%s' "$estado" ;;
    esac
}

# Imprime una celda de estado con padding fijo para tabla (6 visible + bordes)
estado_celda() {
    local estado="$1"
    local pad=""
    case "$estado" in
        OK)   pad="  "; printf ' %b%s%b%s ' "${GREEN}" "${SYM_OK} OK" "${RESET}" "$pad" ;;
        FAIL) pad=""; printf ' %b%s%b%s ' "${RED}" "${SYM_FAIL} FAIL" "${RESET}" "$pad" ;;
        SKIP) pad=""; printf ' %b%s%b%s ' "${YELLOW}" "${SYM_SKIP} SKIP" "${RESET}" "$pad" ;;
        PEND) pad="  "; printf ' %b%s%b%s ' "${DIM}" "${SYM_PEND} --" "${RESET}" "$pad" ;;
        *)    printf ' %-6s ' "$estado" ;;
    esac
}

# Imprime un estado con color y padding a ancho fijo visible
_print_estado_col() {
    local estado="$1"
    local ancho="${2:-10}"
    local texto=""
    local color=""
    case "$estado" in
        OK)   color="${GREEN}"; texto="${SYM_OK} OK" ;;
        FAIL) color="${RED}"; texto="${SYM_FAIL} FAIL" ;;
        SKIP) color="${YELLOW}"; texto="${SYM_SKIP} SKIP" ;;
        PEND) color="${DIM}"; texto="${SYM_PEND} --" ;;
        *)    color=""; texto="$estado" ;;
    esac
    local visible_len=${#texto}
    local pad=$((ancho - visible_len))
    [ "$pad" -lt 0 ] && pad=0
    printf '%b%s%b%*s' "$color" "$texto" "${RESET}" "$pad" ""
}

log_evento() {
    local nivel="$1"
    local mensaje="$2"
    printf '[%s] [%s] %s\n' "$(timestamp)" "$nivel" "$mensaje" >> "$LOG_FILE"
}

mostrar_progreso_global() {
    # Progreso se muestra inline en cada paso
    :
}

step_start() {
    local mensaje="$1"
    if [ ! -t 1 ]; then
        echo -e "   ${DIM}[$(timestamp)]${RESET} ${BLUE}[STEP]${RESET} ${WHITE}${mensaje}${RESET}"
    fi
}

mostrar_spinner() {
    local pid=$1
    local mensaje=$2
    local servidor=$3
    local inicio_epoch=$4
    local delay=0.08
    local barra_ancho=14
    local ultimo_heartbeat=-1
    local frame_index=0

    cursor_hide
    while kill -0 "$pid" 2>/dev/null; do
        local frame="${BRAILLE[$((frame_index % ${#BRAILLE[@]}))]}"
        local ahora_epoch
        local transcurrido
        local transcurrido_fmt
        local siguiente_paso
        local porcentaje

        frame_index=$((frame_index + 1))
        ahora_epoch=$(date +%s)
        transcurrido=$((ahora_epoch - inicio_epoch))
        transcurrido_fmt=$(formatear_duracion "$transcurrido")
        siguiente_paso=$((STEPS_COMPLETADOS + 1))
        porcentaje=$((siguiente_paso * 100 / TOTAL_STEPS))

        # Barra animada tipo onda
        local fase=$(( frame_index % (barra_ancho + 6) ))
        local barra=""
        local j=0
        while [ "$j" -lt "$barra_ancho" ]; do
            local diff=$(( fase - j ))
            [ "$diff" -lt 0 ] && diff=$(( -diff ))
            if [ "$diff" -le 1 ]; then
                barra="${barra}━"
            elif [ "$diff" -le 2 ]; then
                barra="${barra}─"
            elif [ "$diff" -le 3 ]; then
                barra="${barra}╌"
            else
                barra="${barra} "
            fi
            j=$((j + 1))
        done

        if [ -t 1 ]; then
            printf "\r\033[K   ${WHITE}%s${RESET}  ${WHITE}%s${RESET}  ${GR4}%s${RESET}  ${WHITE}%s${RESET}  ${DIM}%s${RESET}  ${WHITE}%d/%d${RESET} ${DIM}(%d%%)${RESET}" \
                "$frame" "$transcurrido_fmt" "$barra" "$mensaje" "$servidor" "$siguiente_paso" "$TOTAL_STEPS" "$porcentaje"
        else
            # En salidas no interactivas, emite heartbeat cada 5s.
            if [ $((transcurrido % 5)) -eq 0 ] && [ "$transcurrido" -ne "$ultimo_heartbeat" ]; then
                ultimo_heartbeat="$transcurrido"
                echo -e "   ${WHITE}${SYM_BULLET}${RESET}  ${WHITE}${transcurrido_fmt}${RESET}  ${WHITE}${mensaje}${RESET}  ${DIM}${servidor}${RESET}  ${WHITE}${siguiente_paso}/${TOTAL_STEPS}${RESET} ${DIM}(${porcentaje}%)${RESET}"
            fi
        fi

        sleep "$delay"
    done
    if [ -t 1 ]; then
        printf "\r\033[K"
    fi
    cursor_show
}

ejecutar_paso() {
    local ip="$1"
    local nombre_paso="$2"
    local comando="$3"
    local inicio_paso
    local fin_paso
    local duracion_paso

    step_start "$nombre_paso"
    log_evento "INFO" "[$ip] Inicio: $nombre_paso"

    inicio_paso=$(date +%s)
    eval "$comando" >> "$LOG_FILE" 2>&1 &
    local pid=$!

    mostrar_spinner "$pid" "$nombre_paso" "$ip" "$inicio_paso"
    wait "$pid"
    local rc=$?

    fin_paso=$(date +%s)
    duracion_paso=$((fin_paso - inicio_paso))
    STEPS_COMPLETADOS=$((STEPS_COMPLETADOS + 1))

    if [ "$rc" -eq 0 ]; then
        echo -e "   ${GREEN}${BOLD}${SYM_OK}${RESET}  ${WHITE}${nombre_paso}${RESET}  ${DIM}${duracion_paso}s  │  ${STEPS_COMPLETADOS}/${TOTAL_STEPS}${RESET}"
        log_evento "OK" "[$ip] Completado: $nombre_paso (${duracion_paso}s)"
    else
        echo -e "   ${RED}${SYM_FAIL}${RESET}  ${WHITE}${nombre_paso}${RESET}  ${DIM}${duracion_paso}s${RESET}  ${WHITE}${STEPS_COMPLETADOS}/${TOTAL_STEPS}${RESET}"
        echo -e "     ${DIM}Log: ${LOG_FILE}${RESET}"
        log_evento "ERROR" "[$ip] Fallo: $nombre_paso (rc=$rc, ${duracion_paso}s)"
    fi

    if [ ! -t 1 ]; then
        mostrar_progreso_global "$STEPS_COMPLETADOS" "$TOTAL_STEPS"
    fi

    return "$rc"
}

log_header() {
    clear
    echo
    echo -e "     ${WHITE}${BOLD}${SYM_MEDICAL}  S R S   M E D I C${RESET}"
    echo -e "     ${DIM}Deploy Orchestrator${RESET}"
    echo
    echo -e "     ${WHITE}Inicio${RESET}     ${DIM}$(timestamp)${RESET}"
    echo -e "     ${WHITE}Log${RESET}        ${DIM}${LOG_FILE}${RESET}"
    echo -e "     ${WHITE}Usuario${RESET}    ${DIM}${USUARIO}${RESET}"
    echo -e "     ${WHITE}Destino${RESET}    ${DIM}${RUTA_DESTINO}${RESET}"
    echo -e "     ${WHITE}Nodos${RESET}      ${DIM}${#SERVIDORES[@]}${RESET}"
    echo -e "     ${WHITE}Pipeline${RESET}   ${DIM}${TOTAL_STEPS} pasos (1 build + 2 × nodo)${RESET}"
    echo -e "     ${WHITE}Flujo${RESET}      ${DIM}Build local → Rsync → Docker compose${RESET}"
    echo
    local idx=0
    for ip in "${SERVIDORES[@]}"; do
        idx=$((idx + 1))
        echo -e "     ${WHITE}${SYM_DOT}${RESET}  ${WHITE}$ip${RESET}"
    done
    echo
    mostrar_progreso_global 0 "$TOTAL_STEPS"
    echo
    log_evento "INFO" "Inicio de despliegue sobre ${#SERVIDORES[@]} nodo(s)"
}

log_server_start() {
    local ip="$1"
    local actual="$2"
    local total="$3"
    echo
    echo -e "   ${WHITE}${BOLD}Nodo ${actual}/${total}${RESET}  ${WHITE}$ip${RESET}  ${DIM}remote pipeline${RESET}"
    echo
    log_evento "INFO" "[$ip] Procesando nodo ${actual}/${total}"
}

log_final_summary() {
    local exitos=$1
    local fallos=$2
    local duracion=$3
    local i=0
    local total_nodos="${#SERVIDORES[@]}"
    local nodos_con_error=()
    local lista_fallos=""
    local sync_estado
    local docker_estado
    local estado_final
    local duracion_fmt
    local duracion_promedio=0
    local suma_duracion=0
    local W=72

    if [ -t 1 ]; then
        clear
    fi

    local dur_fmt
    dur_fmt=$(formatear_duracion "$duracion")
    local hrule_thick hrule_thin
    hrule_thick=$(printf '%.0s━' $(seq 1 $W))
    hrule_thin=$(printf '%.0s─' $(seq 1 $W))

    # ══════════════════════════════════════════════════════════════════════
    # TÍTULO
    # ══════════════════════════════════════════════════════════════════════
    echo
    echo -e "     ${WHITE}${BOLD}${SYM_MEDICAL}  S R S   M E D I C${RESET}  ${DIM}Deploy Summary${RESET}"
    echo -e "     ${DIM}${hrule_thick}${RESET}"
    echo

    # ══════════════════════════════════════════════════════════════════════
    # SECCIÓN 1: RESUMEN GENERAL
    # ══════════════════════════════════════════════════════════════════════
    echo -e "     ${CYAN}${BOLD}RESUMEN GENERAL${RESET}"
    echo -e "     ${DIM}${hrule_thin}${RESET}"
    echo
    printf '     %-18s %s\n' "Duración" "$dur_fmt"
    printf '     %-18s ' "Resultado"
    printf '%b%s%b  /  %b%s%b\n' "${GREEN}${BOLD}" "${exitos} OK" "${RESET}" "${RED}${BOLD}" "${fallos} FAIL" "${RESET}"
    printf '     %-18s %s\n' "Nodos" "$total_nodos"
    printf '     %-18s %s\n' "Log" "$LOG_FILE"
    echo

    # ══════════════════════════════════════════════════════════════════════
    # SECCIÓN 2: ESTADO POR NODO
    # ══════════════════════════════════════════════════════════════════════
    echo -e "     ${CYAN}${BOLD}ESTADO POR NODO${RESET}"
    echo -e "     ${DIM}${hrule_thin}${RESET}"
    echo

    # Encabezados de tabla
    printf '     %b%-4s  %-18s  %-10s  %-10s  %-10s  %-8s%b\n' \
        "${WHITE}${BOLD}" "#" "Nodo" "Sync" "Docker" "Estado" "Tiempo" "${RESET}"
    printf '     %b%-4s  %-18s  %-10s  %-10s  %-10s  %-8s%b\n' \
        "${DIM}" "──" "──────────────────" "──────────" "──────────" "──────────" "────────" "${RESET}"

    while [ "$i" -lt "$total_nodos" ]; do
        sync_estado="${RESULTADOS_SYNC_NODO[$i]:-PEND}"
        docker_estado="${RESULTADOS_DOCKER_NODO[$i]:-PEND}"
        estado_final="${RESULTADOS_NODO[$i]:-PEND}"
        duracion_fmt=$(formatear_duracion "${DURACION_NODO[$i]:-0}")
        suma_duracion=$((suma_duracion + ${DURACION_NODO[$i]:-0}))

        printf '     %-4d  %-18s  ' "$((i + 1))" "${SERVIDORES[$i]}"
        _print_estado_col "$sync_estado" 10
        printf '  '
        _print_estado_col "$docker_estado" 10
        printf '  '
        _print_estado_col "$estado_final" 10
        printf '  %s\n' "$duracion_fmt"

        if [ "$estado_final" != "OK" ]; then
            nodos_con_error+=("${SERVIDORES[$i]}")
        fi

        i=$((i + 1))
    done

    echo

    # Estadísticas de nodos
    if [ "$total_nodos" -gt 0 ]; then
        duracion_promedio=$((suma_duracion / total_nodos))
    fi

    printf '     %b%-18s%b  %b%s%b\n' \
        "${DIM}" "Promedio por nodo" "${RESET}" "${WHITE}" "$(formatear_duracion "$duracion_promedio")" "${RESET}"

    if [ "${#nodos_con_error[@]}" -gt 0 ]; then
        lista_fallos=$(printf '%s, ' "${nodos_con_error[@]}")
        lista_fallos=${lista_fallos%, }
        printf '     %b%-18s%b  %b%s%b\n' \
            "${RED}${BOLD}" "Nodos con error" "${RESET}" "${RED}" "$lista_fallos" "${RESET}"
    fi
    echo

    # ══════════════════════════════════════════════════════════════════════
    # SECCIÓN 3: REGISTRO DE ACTIVIDAD
    # ══════════════════════════════════════════════════════════════════════
    if [ -f "$LOG_FILE" ]; then
        local log_count
        log_count=$(grep -c '^\[' "$LOG_FILE" 2>/dev/null || echo 0)
        echo -e "     ${CYAN}${BOLD}REGISTRO DE ACTIVIDAD${RESET}  ${DIM}(últimas 14 de ${log_count} entradas)${RESET}"
        echo -e "     ${DIM}${hrule_thin}${RESET}"
        echo

        printf '     %b%-21s  %-7s  %s%b\n' \
            "${WHITE}${BOLD}" "Timestamp" "Level" "Message" "${RESET}"
        printf '     %b%-21s  %-7s  %s%b\n' \
            "${DIM}" "─────────────────────" "───────" "────────────────────────────────────────" "${RESET}"

        grep '^\[' "$LOG_FILE" | tail -n 14 | while IFS= read -r linea; do
            local ts lvl msg color_lvl
            ts=$(echo "$linea" | sed -n 's/^\[\([^]]*\)\].*/\1/p')
            lvl=$(echo "$linea" | sed -n 's/^\[[^]]*\] \[\([^]]*\)\].*/\1/p')
            msg=$(echo "$linea" | sed 's/^\[[^]]*\] \[[^]]*\] //')
            if [ ${#msg} -gt 46 ]; then
                msg="${msg:0:43}..."
            fi
            case "$lvl" in
                OK)    color_lvl="${GREEN}" ;;
                ERROR) color_lvl="${RED}" ;;
                WARN)  color_lvl="${YELLOW}" ;;
                *)     color_lvl="${DIM}" ;;
            esac
            printf '     %b%-21s%b  ' "${DIM}" "$ts" "${RESET}"
            printf '%b%-7s%b  ' "$color_lvl" "$lvl" "${RESET}"
            printf '%b%s%b\n' "${DIM}" "$msg" "${RESET}"
        done
    fi

    # ══════════════════════════════════════════════════════════════════════
    # RESULTADO FINAL
    # ══════════════════════════════════════════════════════════════════════
    echo
    echo -e "     ${DIM}${hrule_thick}${RESET}"
    if [ "$fallos" -eq 0 ]; then
        echo -e "     ${GREEN}${BOLD}${SYM_OK}  DESPLIEGUE COMPLETADO EXITOSAMENTE${RESET}"
        log_evento "OK" "Despliegue finalizado sin errores (${duracion}s)"
    else
        echo -e "     ${RED}${BOLD}${SYM_FAIL}  DESPLIEGUE FINALIZADO CON ERRORES${RESET}"
        log_evento "ERROR" "Despliegue finalizado con errores (${duracion}s)"
    fi
    echo
}


log_header

TIEMPO_INICIO_TOTAL=$(date +%s)
SERVIDORES_EXITOSOS=0
SERVIDORES_FALLIDOS=0
TOTAL_SERVIDORES=${#SERVIDORES[@]}
INDICE_SERVIDOR=0


echo
echo -e "   ${WHITE}${BOLD}Etapa 1${RESET}  ${DIM}Build local de artefactos con Vite${RESET}"
echo

MENSAJE_BUILD="Ejecutando npm install + npm run build"
COMANDO_BUILD="npm install && npm run build"

if ! ejecutar_paso "local" "$MENSAJE_BUILD" "$COMANDO_BUILD"; then
    echo
    echo -e "     ${RED}${BOLD}${SYM_FAIL}  BUILD LOCAL FALLIDO — DESPLIEGUE ABORTADO${RESET}"
    echo
    log_evento "ERROR" "Build local fallido, despliegue abortado"
    exit 1
fi

# Verificar que dist/ existe y tiene contenido
if [ ! -d "dist" ] || [ -z "$(ls -A dist 2>/dev/null)" ]; then
    echo
    echo -e "     ${RED}${BOLD}${SYM_FAIL}  dist/ NO EXISTE — DESPLIEGUE ABORTADO${RESET}"
    echo
    log_evento "ERROR" "dist/ no encontrado tras build"
    exit 1
fi

echo -e "   ${GREEN}${SYM_OK}${RESET}  ${WHITE}Build local exitoso${RESET}"
ARCHIVOS_DIST=$(find dist -type f | wc -l | tr -d ' ')
TAMANO_DIST=$(du -sh dist | awk '{print $1}')
echo -e "     ${DIM}Artefactos: ${ARCHIVOS_DIST} archivos (${TAMANO_DIST})${RESET}"
echo

for IP in "${SERVIDORES[@]}"; do
    INDICE_SERVIDOR=$((INDICE_SERVIDOR + 1))
    log_server_start "$IP" "$INDICE_SERVIDOR" "$TOTAL_SERVIDORES"
    TIEMPO_INICIO_NODO=$(date +%s)
    ERROR_EN_NODO=0
    ESTADO_SYNC="PEND"
    ESTADO_DOCKER="PEND"

    # PASO 1: Sincronización de Archivos (incluyendo dist/ pre-construido)
    MENSAJE_SYNC="Sincronizando codigo fuente + dist (rsync)"
    COMANDO_SYNC="rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.env' ./ '$USUARIO@$IP:$RUTA_DESTINO'"

    if ! ejecutar_paso "$IP" "$MENSAJE_SYNC" "$COMANDO_SYNC"; then
        ERROR_EN_NODO=1
        ESTADO_SYNC="FAIL"
        ESTADO_DOCKER="SKIP"
    else
        ESTADO_SYNC="OK"
    fi

    # PASO 2: Reconstrucción de contenedor (solo nginx, sin build de JS)
    if [ $ERROR_EN_NODO -eq 0 ]; then
        MENSAJE_DOCKER="Reconstruyendo e iniciando contenedores"
        COMANDO_DOCKER="ssh '$USUARIO@$IP' 'cd $RUTA_DESTINO && docker compose down && docker compose up -d --build'"

        if ! ejecutar_paso "$IP" "$MENSAJE_DOCKER" "$COMANDO_DOCKER"; then
            ERROR_EN_NODO=1
            ESTADO_DOCKER="FAIL"
        else
            ESTADO_DOCKER="OK"
        fi
    else
        STEPS_COMPLETADOS=$((STEPS_COMPLETADOS + 1))
        echo -e "   ${YELLOW}${SYM_SKIP}${RESET}  ${WHITE}Reconstruyendo e iniciando contenedores${RESET} ${DIM}(omitido por error previo)${RESET}"
        log_evento "WARN" "[$IP] Paso de contenedores omitido por error previo"
        if [ ! -t 1 ]; then
            mostrar_progreso_global "$STEPS_COMPLETADOS" "$TOTAL_STEPS"
        fi
    fi

    TIEMPO_FIN_NODO=$(date +%s)
    TIEMPO_NODO=$((TIEMPO_FIN_NODO - TIEMPO_INICIO_NODO))
    
    if [ $ERROR_EN_NODO -eq 0 ]; then
        ((SERVIDORES_EXITOSOS++))
        RESULTADOS_NODO+=("OK")
        DURACION_NODO+=("$TIEMPO_NODO")
        RESULTADOS_SYNC_NODO+=("$ESTADO_SYNC")
        RESULTADOS_DOCKER_NODO+=("$ESTADO_DOCKER")
        echo -e "     ${DIM}Nodo completado en ${TIEMPO_NODO}s${RESET}"
        log_evento "OK" "[$IP] Nodo completado en ${TIEMPO_NODO}s"
    else
        ((SERVIDORES_FALLIDOS++))
        RESULTADOS_NODO+=("FAIL")
        DURACION_NODO+=("$TIEMPO_NODO")
        RESULTADOS_SYNC_NODO+=("$ESTADO_SYNC")
        RESULTADOS_DOCKER_NODO+=("$ESTADO_DOCKER")
        echo -e "     ${RED}Nodo finalizado con error en ${TIEMPO_NODO}s${RESET}"
        log_evento "ERROR" "[$IP] Nodo finalizado con error en ${TIEMPO_NODO}s"
    fi

done


TIEMPO_FIN_TOTAL=$(date +%s)
DURACION_TOTAL=$((TIEMPO_FIN_TOTAL - TIEMPO_INICIO_TOTAL))

log_final_summary "$SERVIDORES_EXITOSOS" "$SERVIDORES_FALLIDOS" "$DURACION_TOTAL"