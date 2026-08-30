/**
 * Configuração da aplicação (ver research.md §6 para o raciocínio por trás destes valores).
 */

/** Espaçamento da grade lat/long buscada do Open-Meteo, em graus. */
export const DEFAULT_GRID_RESOLUTION_DEGREES = 10

/**
 * Intervalo de re-busca automática dos dados de temperatura (US4). 30 minutos — com folga de
 * segurança abaixo do piso de 60 minutos de FR-007/SC-003, e muito abaixo do necessário para
 * respeitar o limite de uso não-comercial do Open-Meteo (10.000 requisições/dia).
 */
export const TEMPERATURE_REFRESH_INTERVAL_MS = 30 * 60 * 1000
