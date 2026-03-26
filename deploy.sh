#!/bin/bash

# ==============================================================================
# CONFIGURACIÓN DEL DESPLIEGUE
# ==============================================================================
SERVIDORES=("100.122.4.91" "100.122.11.120" "100.95.63.70" "100.119.224.75")
USUARIO="prometeo"
RUTA_DESTINO="/home/prometeo/srs-medic"
LOG_FILE="deploy_$(date +%Y%m%d_%H%M%S).log"

# ==============================================================================
# CÓDIGOS DE COLOR Y FORMATO
# ==============================================================================
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
CYAN='\033[36m'
WHITE='\033[37m'

BG_BLUE_FG_WHITE='\033[44;97m'
BG_GREEN_FG_WHITE='\033[42;97m'
BG_RED_FG_WHITE='\033[41;97m'

TOTAL_STEPS=$(( ${#SERVIDORES[@]} * 2 ))
STEPS_COMPLETADOS=0

declare -a RESULTADOS_NODO
declare -a DURACION_NODO

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

hline() {
    printf '%*s\n' "${1:-72}" '' | tr ' ' '='
}

log_evento() {
    local nivel="$1"
    local mensaje="$2"
    printf '[%s] [%s] %s\n' "$(timestamp)" "$nivel" "$mensaje" >> "$LOG_FILE"
}

mostrar_progreso_global() {
    local completados="$1"
    local total="$2"
    local ancho=34
    local llenos=0
    local vacios=0
    local barra_llena=""
    local barra_vacia=""

    if [ "$total" -gt 0 ]; then
        llenos=$(( completados * ancho / total ))
        vacios=$(( ancho - llenos ))
    fi

    barra_llena=$(printf '%*s' "$llenos" '' | tr ' ' '#')
    barra_vacia=$(printf '%*s' "$vacios" '' | tr ' ' '-')

    echo -e "${DIM}Progreso global:${RESET} [${GREEN}${barra_llena}${RESET}${DIM}${barra_vacia}${RESET}] ${BOLD}${completados}/${total}${RESET}"
}

step_start() {
    local mensaje="$1"
    echo -e "   ${DIM}[$(timestamp)]${RESET} ${WHITE}${mensaje}${RESET}"
}

mostrar_spinner() {
    local pid=$1
    local mensaje=$2
    local servidor=$3
    local inicio_epoch=$4
    local delay=0.1
    local frames=("[    ]" "[=   ]" "[==  ]" "[=== ]" "[ ===]" "[  ==]" "[   =]" "[    ]")
    local ancho_pulso=24
    local tam_bloque=7
    local ultimo_heartbeat=-1
    local i=0
    
    cursor_hide
    while kill -0 "$pid" 2>/dev/null; do
        for frame in "${frames[@]}"; do
            if ! kill -0 "$pid" 2>/dev/null; then
                break
            fi
            local ahora_epoch
            local transcurrido
            local pos
            local barra=""
            local limite
            ahora_epoch=$(date +%s)
            transcurrido=$((ahora_epoch - inicio_epoch))

            # Barra animada continua tipo "cinta" para indicar actividad en tiempo real.
            pos=$((transcurrido % ancho_pulso))
            limite=$((pos + tam_bloque))
            for ((i=0; i<ancho_pulso; i++)); do
                if [ "$i" -ge "$pos" ] && [ "$i" -lt "$limite" ]; then
                    barra+="="
                else
                    barra+="-"
                fi
            done

            if [ -t 1 ]; then
                printf "\r\033[K   ${CYAN}%s${RESET} %s ${CYAN}[%s]${RESET} ${DIM}| host:${RESET} %s ${DIM}| t+%ss${RESET}" \
                    "$frame" "$mensaje" "$barra" "$servidor" "$transcurrido"
            else
                # En salidas no interactivas, emite heartbeat cada 5s.
                if [ $((transcurrido % 5)) -eq 0 ] && [ "$transcurrido" -ne "$ultimo_heartbeat" ]; then
                    ultimo_heartbeat="$transcurrido"
                    echo -e "   ${CYAN}${frame}${RESET} ${mensaje} ${CYAN}[${barra}]${RESET} ${DIM}| host:${RESET} ${servidor} ${DIM}| t+${transcurrido}s${RESET}"
                fi
            fi
            sleep $delay
        done
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
        echo -e "   [${GREEN} OK ${RESET}] ${nombre_paso} ${DIM}(${duracion_paso}s)${RESET}"
        log_evento "OK" "[$ip] Completado: $nombre_paso (${duracion_paso}s)"
    else
        echo -e "   [${RED}FAIL${RESET}] ${nombre_paso} ${DIM}(${duracion_paso}s)${RESET}"
        echo -e "   ${YELLOW}Ultimas lineas del log:${RESET}"
        tail -n 12 "$LOG_FILE" | sed 's/^/      > /'
        log_evento "ERROR" "[$ip] Fallo: $nombre_paso (rc=$rc, ${duracion_paso}s)"
    fi

    mostrar_progreso_global "$STEPS_COMPLETADOS" "$TOTAL_STEPS"
    echo

    return "$rc"
}

log_header() {
    clear
    hline
    echo -e "${BOLD}${BG_BLUE_FG_WHITE}                    CENTRO DE DESPLIEGUE SRS MEDIC                    ${RESET}"
    hline
    echo -e "${DIM}Inicio:${RESET}    $(timestamp)"
    echo -e "${DIM}Registro:${RESET}  ${CYAN}$LOG_FILE${RESET}"
    echo -e "${DIM}Usuario:${RESET}   $USUARIO"
    echo -e "${DIM}Destino:${RESET}   $RUTA_DESTINO"
    echo -e "${DIM}Nodos:${RESET}     ${#SERVIDORES[@]}"
    echo -e "${DIM}Pasos:${RESET}     ${TOTAL_STEPS} (2 por nodo)"
    hline

    local idx=1
    for ip in "${SERVIDORES[@]}"; do
        echo -e "  ${DIM}${idx}. ${WHITE}$ip${RESET}"
        idx=$((idx + 1))
    done
    hline
    echo
    mostrar_progreso_global 0 "$TOTAL_STEPS"
    echo
    log_evento "INFO" "Inicio de despliegue sobre ${#SERVIDORES[@]} nodo(s)"
}

log_server_start() {
    local ip="$1"
    local actual="$2"
    local total="$3"
    hline
    echo -e "${BOLD}${BLUE}Nodo ${actual}/${total}${RESET} ${DIM}->${RESET} ${WHITE}$ip${RESET}"
    hline
    log_evento "INFO" "[$ip] Procesando nodo ${actual}/${total}"
}

log_final_summary() {
    local exitos=$1
    local fallos=$2
    local duracion=$3
    
    hline
    echo -e "${BOLD}RESUMEN DE EJECUCION${RESET}"
    hline
    echo -e "${DIM}Tiempo total:${RESET} ${BOLD}${duracion}s${RESET}"
    echo -e "${DIM}Resultado:${RESET}   ${GREEN}${exitos} exitosos${RESET} / ${RED}${fallos} fallidos${RESET}"
    echo -e "${DIM}Log:${RESET}         ${CYAN}$LOG_FILE${RESET}"
    hline
    echo -e "${BOLD}Detalle por nodo:${RESET}"

    local i=0
    for ip in "${SERVIDORES[@]}"; do
        local estado="${RESULTADOS_NODO[$i]}"
        local dur="${DURACION_NODO[$i]}"

        if [ "$estado" = "OK" ]; then
            echo -e "  ${GREEN}OK  ${RESET} $ip ${DIM}| ${dur}s${RESET}"
        else
            echo -e "  ${RED}FAIL${RESET} $ip ${DIM}| ${dur}s${RESET}"
        fi
        i=$((i + 1))
    done

    hline
    
    if [ "$fallos" -eq 0 ]; then
        echo -e "${BG_GREEN_FG_WHITE}${BOLD} DESPLIEGUE COMPLETADO EXITOSAMENTE ${RESET}"
        log_evento "OK" "Despliegue finalizado sin errores (${duracion}s)"
    else
        echo -e "${BG_RED_FG_WHITE}${BOLD} DESPLIEGUE FINALIZADO CON ERRORES ${RESET}"
        log_evento "ERROR" "Despliegue finalizado con errores (${duracion}s)"
    fi
    echo -e ""
}

# ==============================================================================
# EJECUCIÓN PRINCIPAL
# ==============================================================================

log_header

TIEMPO_INICIO_TOTAL=$(date +%s)
SERVIDORES_EXITOSOS=0
SERVIDORES_FALLIDOS=0
TOTAL_SERVIDORES=${#SERVIDORES[@]}
INDICE_SERVIDOR=0

for IP in "${SERVIDORES[@]}"; do
    INDICE_SERVIDOR=$((INDICE_SERVIDOR + 1))
    log_server_start "$IP" "$INDICE_SERVIDOR" "$TOTAL_SERVIDORES"
    TIEMPO_INICIO_NODO=$(date +%s)
    ERROR_EN_NODO=0

    # PASO 1: Sincronización de Archivos
    MENSAJE_SYNC="Sincronizando codigo fuente (rsync)"
    COMANDO_SYNC="rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.env' ./ '$USUARIO@$IP:$RUTA_DESTINO'"

    if ! ejecutar_paso "$IP" "$MENSAJE_SYNC" "$COMANDO_SYNC"; then
        ERROR_EN_NODO=1
    fi

    # PASO 2: Construcción y Despliegue de Contenedores
    if [ $ERROR_EN_NODO -eq 0 ]; then
        MENSAJE_DOCKER="Reconstruyendo e iniciando contenedores"
        COMANDO_DOCKER="ssh '$USUARIO@$IP' 'cd $RUTA_DESTINO && docker compose down && docker compose up -d --build'"

        if ! ejecutar_paso "$IP" "$MENSAJE_DOCKER" "$COMANDO_DOCKER"; then
            ERROR_EN_NODO=1
        fi
    else
        STEPS_COMPLETADOS=$((STEPS_COMPLETADOS + 1))
        echo -e "   [${YELLOW}SKIP${RESET}] Reconstruyendo e iniciando contenedores ${DIM}(omitido por error previo)${RESET}"
        log_evento "WARN" "[$IP] Paso de contenedores omitido por error previo"
        mostrar_progreso_global "$STEPS_COMPLETADOS" "$TOTAL_STEPS"
        echo
    fi

    TIEMPO_FIN_NODO=$(date +%s)
    TIEMPO_NODO=$((TIEMPO_FIN_NODO - TIEMPO_INICIO_NODO))
    
    if [ $ERROR_EN_NODO -eq 0 ]; then
        ((SERVIDORES_EXITOSOS++))
        RESULTADOS_NODO+=("OK")
        DURACION_NODO+=("$TIEMPO_NODO")
        echo -e "${DIM}Nodo finalizado en ${TIEMPO_NODO}s.${RESET}\n"
        log_evento "OK" "[$IP] Nodo completado en ${TIEMPO_NODO}s"
    else
        ((SERVIDORES_FALLIDOS++))
        RESULTADOS_NODO+=("FAIL")
        DURACION_NODO+=("$TIEMPO_NODO")
        echo -e "${DIM}${RED}Nodo finalizado con error en ${TIEMPO_NODO}s.${RESET}\n"
        log_evento "ERROR" "[$IP] Nodo finalizado con error en ${TIEMPO_NODO}s"
    fi

done

# ==============================================================================
# FINALIZACIÓN
# ==============================================================================
TIEMPO_FIN_TOTAL=$(date +%s)
DURACION_TOTAL=$((TIEMPO_FIN_TOTAL - TIEMPO_INICIO_TOTAL))

log_final_summary "$SERVIDORES_EXITOSOS" "$SERVIDORES_FALLIDOS" "$DURACION_TOTAL"