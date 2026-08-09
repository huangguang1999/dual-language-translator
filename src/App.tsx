import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  DEFAULT_LEFT_LANGUAGE,
  DEFAULT_RIGHT_LANGUAGE,
  LANGUAGES,
  getLanguage,
  type LanguageCode,
} from './languages'
import {
  getUtf8ByteLength,
  MAX_SOURCE_BYTES,
  translateText,
  trimToUtf8ByteLimit,
} from './translation'

type PanelSide = 'left' | 'right'

type TranslationJob = {
  id: number
  sourceSide: PanelSide
  sourceText: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
}

type TranslationStatus =
  | { state: 'idle' }
  | { state: 'queued'; sourceSide: PanelSide }
  | { state: 'translating'; sourceSide: PanelSide }
  | { state: 'success'; sourceSide: PanelSide }
  | { state: 'error'; sourceSide: PanelSide; message: string }

const TRANSLATION_DEBOUNCE_MS = 450

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7-4 4 4 4M3 11h13M17 17l4-4-4-4M21 13H8" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 3h6l1 4H8l1-4ZM6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  )
}

type LanguagePanelProps = {
  side: PanelSide
  language: LanguageCode
  oppositeLanguage: LanguageCode
  value: string
  isActive: boolean
  isTranslating: boolean
  copied: boolean
  onLanguageChange: (language: LanguageCode) => void
  onTextChange: (value: string) => void
  onCopy: () => void
}

function LanguagePanel({
  side,
  language,
  oppositeLanguage,
  value,
  isActive,
  isTranslating,
  copied,
  onLanguageChange,
  onTextChange,
  onCopy,
}: LanguagePanelProps) {
  const languageDetails = getLanguage(language)
  const isLeft = side === 'left'
  const panelTitle = isLeft ? '左侧语言' : '右侧语言'
  const placeholder = isLeft ? '在这里输入文字…' : '也可以从这里开始输入…'

  return (
    <section
      className={`language-panel ${isActive ? 'is-active' : ''}`}
      aria-label={`${panelTitle}：${languageDetails.label}`}
    >
      <div className="language-toolbar">
        <div>
          <span className="panel-eyebrow">{panelTitle}</span>
          <label className="language-select-wrap">
            <span className="sr-only">选择{panelTitle}</span>
            <span className="language-short-code">{languageDetails.shortCode}</span>
            <select
              value={language}
              onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
              aria-label={`选择${panelTitle}`}
            >
              {LANGUAGES.map((option) => (
                <option
                  key={option.code}
                  value={option.code}
                  disabled={option.code === oppositeLanguage}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className={`input-badge ${isActive ? 'is-visible' : ''}`}>
          {isTranslating ? '正在翻译' : '当前输入端'}
        </span>
      </div>

      <div className="textarea-wrap">
        <textarea
          value={value}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={placeholder}
          aria-label={`${languageDetails.label}文本`}
          dir="auto"
          spellCheck
        />
        {isTranslating && !isActive ? <div className="translation-shimmer" /> : null}
      </div>

      <div className="panel-footer">
        <span className="byte-count">
          {getUtf8ByteLength(value)} / {MAX_SOURCE_BYTES} bytes
        </span>
        <button
          type="button"
          className="icon-button copy-button"
          onClick={onCopy}
          disabled={!value}
          aria-label={`复制${panelTitle}文字`}
        >
          <CopyIcon />
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>
    </section>
  )
}

function App() {
  const [leftLanguage, setLeftLanguage] = useState<LanguageCode>(DEFAULT_LEFT_LANGUAGE)
  const [rightLanguage, setRightLanguage] = useState<LanguageCode>(DEFAULT_RIGHT_LANGUAGE)
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [activeSide, setActiveSide] = useState<PanelSide>('left')
  const [translationJob, setTranslationJob] = useState<TranslationJob | null>(null)
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>({ state: 'idle' })
  const [copiedSide, setCopiedSide] = useState<PanelSide | null>(null)
  const nextJobId = useRef(0)
  const latestJobId = useRef(0)
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!translationJob) {
      return
    }

    const controller = new AbortController()
    const job = translationJob
    const timer = setTimeout(() => {
      setTranslationStatus({ state: 'translating', sourceSide: job.sourceSide })

      void translateText(
        job.sourceText,
        job.sourceLanguage,
        job.targetLanguage,
        controller.signal,
      )
        .then((translatedText) => {
          if (latestJobId.current !== job.id) {
            return
          }

          if (job.sourceSide === 'left') {
            setRightText(translatedText)
          } else {
            setLeftText(translatedText)
          }
          setTranslationStatus({ state: 'success', sourceSide: job.sourceSide })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || latestJobId.current !== job.id) {
            return
          }

          const message = error instanceof Error ? error.message : '翻译失败，请稍后重试。'
          setTranslationStatus({ state: 'error', sourceSide: job.sourceSide, message })
        })
    }, TRANSLATION_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [translationJob])

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        clearTimeout(copyResetTimer.current)
      }
    }
  }, [])

  function queueTranslation(
    sourceSide: PanelSide,
    sourceText: string,
    nextLeftLanguage = leftLanguage,
    nextRightLanguage = rightLanguage,
  ) {
    if (!sourceText.trim()) {
      latestJobId.current = ++nextJobId.current
      setTranslationJob(null)
      setTranslationStatus({ state: 'idle' })
      if (sourceSide === 'left') {
        setRightText('')
      } else {
        setLeftText('')
      }
      return
    }

    const id = ++nextJobId.current
    latestJobId.current = id
    setTranslationStatus({ state: 'queued', sourceSide })
    setTranslationJob({
      id,
      sourceSide,
      sourceText,
      sourceLanguage: sourceSide === 'left' ? nextLeftLanguage : nextRightLanguage,
      targetLanguage: sourceSide === 'left' ? nextRightLanguage : nextLeftLanguage,
    })
  }

  function handleTextChange(side: PanelSide, rawValue: string) {
    const value = trimToUtf8ByteLimit(rawValue, MAX_SOURCE_BYTES)
    setActiveSide(side)

    if (side === 'left') {
      setLeftText(value)
    } else {
      setRightText(value)
    }
    queueTranslation(side, value)
  }

  function handleLanguageChange(side: PanelSide, language: LanguageCode) {
    const nextLeftLanguage = side === 'left' ? language : leftLanguage
    const nextRightLanguage = side === 'right' ? language : rightLanguage

    if (nextLeftLanguage === nextRightLanguage) {
      return
    }

    setLeftLanguage(nextLeftLanguage)
    setRightLanguage(nextRightLanguage)

    const sourceText = activeSide === 'left' ? leftText : rightText
    queueTranslation(activeSide, sourceText, nextLeftLanguage, nextRightLanguage)
  }

  function handleSwap() {
    latestJobId.current = ++nextJobId.current
    setLeftLanguage(rightLanguage)
    setRightLanguage(leftLanguage)
    setLeftText(rightText)
    setRightText(leftText)
    setActiveSide(activeSide === 'left' ? 'right' : 'left')
    setTranslationJob(null)
    setTranslationStatus({ state: 'idle' })
  }

  function handleClear() {
    latestJobId.current = ++nextJobId.current
    setLeftText('')
    setRightText('')
    setTranslationJob(null)
    setTranslationStatus({ state: 'idle' })
  }

  async function handleCopy(side: PanelSide) {
    const text = side === 'left' ? leftText : rightText
    if (!text) {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopiedSide(side)
      if (copyResetTimer.current) {
        clearTimeout(copyResetTimer.current)
      }
      copyResetTimer.current = setTimeout(() => setCopiedSide(null), 1600)
    } catch {
      setTranslationStatus({ state: 'error', sourceSide: side, message: '复制失败，请手动选择文字。' })
    }
  }

  const isTranslating =
    translationStatus.state === 'queued' || translationStatus.state === 'translating'
  const statusSourceSide = 'sourceSide' in translationStatus ? translationStatus.sourceSide : null
  const sourceLanguage = getLanguage(activeSide === 'left' ? leftLanguage : rightLanguage)
  const targetLanguage = getLanguage(activeSide === 'left' ? rightLanguage : leftLanguage)

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="Dualingo 首页">
          <span className="brand-mark" aria-hidden="true">
            <span>文</span>
            <span>A</span>
          </span>
          <span>Dualingo</span>
        </a>
        <span className="header-caption">双向即时翻译</span>
      </header>

      <main>
        <div className="intro">
          <span className="intro-pill">双向同步</span>
          <h1>从任意一侧开始输入</h1>
          <p>选择两种语言，左边和右边都能作为输入端，另一侧会自动更新翻译。</p>
        </div>

        <div className="translator-card">
          <div className="translator-grid">
            <LanguagePanel
              side="left"
              language={leftLanguage}
              oppositeLanguage={rightLanguage}
              value={leftText}
              isActive={activeSide === 'left'}
              isTranslating={isTranslating && statusSourceSide === 'left'}
              copied={copiedSide === 'left'}
              onLanguageChange={(language) => handleLanguageChange('left', language)}
              onTextChange={(value) => handleTextChange('left', value)}
              onCopy={() => void handleCopy('left')}
            />

            <div className="middle-actions">
              <button
                type="button"
                className="swap-button"
                onClick={handleSwap}
                aria-label="交换两侧语言和文字"
                title="交换语言"
              >
                <SwapIcon />
              </button>
              <span className="swap-label">交换</span>
            </div>

            <LanguagePanel
              side="right"
              language={rightLanguage}
              oppositeLanguage={leftLanguage}
              value={rightText}
              isActive={activeSide === 'right'}
              isTranslating={isTranslating && statusSourceSide === 'right'}
              copied={copiedSide === 'right'}
              onLanguageChange={(language) => handleLanguageChange('right', language)}
              onTextChange={(value) => handleTextChange('right', value)}
              onCopy={() => void handleCopy('right')}
            />
          </div>

          <div className="translator-status" aria-live="polite">
            <div className="status-message">
              <span className={`status-dot ${isTranslating ? 'is-pulsing' : ''}`} />
              {translationStatus.state === 'error' ? (
                <span className="error-message">{translationStatus.message}</span>
              ) : isTranslating ? (
                <span>
                  正在将{sourceLanguage.label}翻译为{targetLanguage.label}…
                </span>
              ) : (
                <span>输入后约 0.5 秒自动翻译</span>
              )}
            </div>
            <button
              type="button"
              className="clear-button"
              onClick={handleClear}
              disabled={!leftText && !rightText}
            >
              <TrashIcon />
              清空全部
            </button>
          </div>
        </div>

        <p className="service-note">
          翻译由{' '}
          <a href="https://mymemory.translated.net/doc/spec.php" target="_blank" rel="noreferrer">
            MyMemory
          </a>{' '}
          提供。输入内容会发送给该服务处理，请勿输入敏感信息。
        </p>
      </main>

      <footer>Built for simple, focused translation.</footer>
    </div>
  )
}

export default App
