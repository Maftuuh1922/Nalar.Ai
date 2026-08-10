import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const source = readFileSync(
  path.resolve(process.cwd(), 'app/(workspace)/home/[[...sessionId]]/page.tsx'),
  'utf8'
)

test('main chat delegates streaming scroll control to useChatAutoScroll', () => {
  assert.match(source, /import \{ useChatAutoScroll \} from ["']@\/hooks\/useChatAutoScroll["'];?/)
  assert.match(source, /containerRef: messagesContainerRef/)
  assert.match(source, /data-chat-scroll-root="true"/)
  assert.match(source, /onScroll=\{handleMessagesScroll\}/)
})

test('main chat does not imperatively fight user scrolling', () => {
  assert.doesNotMatch(source, /scrollToBottom\s*\(/)
})

test('sending a new main-chat turn re-arms live-follow mode', () => {
  assert.match(source, /sendMessage\([\s\S]*?shouldAutoScrollRef\.current = true;?/)
})
