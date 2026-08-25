import 'server-only'

/** Cliente da Bot API do Telegram — cada organização traz seu próprio bot. */

const TIMEOUT_MS = 10_000

interface TelegramResult<T> {
  success: boolean
  data?: T
  error?: string
}

async function call<T>(token: string, method: string, body?: Record<string, unknown>): Promise<TelegramResult<T>> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const json = await res.json().catch(() => ({}))
    if (!json.ok) return { success: false, error: json.description || `HTTP ${res.status}` }
    return { success: true, data: json.result }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export interface TelegramBotInfo {
  id: number
  username: string
  first_name: string
}

/** Valida o token e devolve dados do bot (usado ao conectar). */
export function telegramGetMe(token: string) {
  return call<TelegramBotInfo>(token, 'getMe')
}

/** Registra a URL de webhook pra esse bot receber updates. */
export function telegramSetWebhook(token: string, url: string) {
  return call<boolean>(token, 'setWebhook', { url })
}

export interface InlineButton {
  text: string
  callback_data: string
}

/** Envia mensagem de texto, opcionalmente com botões inline (aprovar/ajustar). */
export function telegramSendMessage(token: string, chatId: string, text: string, buttons?: InlineButton[][]) {
  return call<{ message_id: number }>(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  })
}

/** Confirma o recebimento de um clique em botão inline (tira o "carregando" no Telegram). */
export function telegramAnswerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  return call<boolean>(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

/** Edita o texto de uma mensagem já enviada (usado pra marcar "já decidido" depois do clique). */
export function telegramEditMessageText(token: string, chatId: string, messageId: number, text: string) {
  return call<boolean>(token, 'editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' })
}
