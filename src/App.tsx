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

type LanguageFlow =
  | { step: 'selecting'; leftLanguage: LanguageCode; rightLanguage: LanguageCode }
  | { step: 'translating'; leftLanguage: LanguageCode; rightLanguage: LanguageCode }

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

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14 5 5 5M4 20l3.5-.7L19 7.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z" />
    </svg>
  )
}

type LanguageSetupProps = {
  leftLanguage: LanguageCode
  rightLanguage: LanguageCode
  onLeftLanguageChange: (language: LanguageCode) => void
  onRightLanguageChange: (language: LanguageCode) => void
  onSwap: () => void
  onStart: () => void
}

function LanguageSetup({
  leftLanguage,
  rightLanguage,
  onLeftLanguageChange,
  onRightLanguageChange,
  onSwap,
  onStart,
}: LanguageSetupProps) {
  const leftLanguageDetails = getLanguage(leftLanguage)
  const rightLanguageDetails = getLanguage(rightLanguage)

  return (
    <div className="setup-card">
      <div className="setup-progress" aria-label="当前是第 1 步，共 2 步">
        <span className="is-current">1</span>
        <i />
        <span>2</span>
      </div>

      <div className="setup-heading">
        <span className="panel-eyebrow">第 1 步</span>
        <h2>选择需要互译的两种语言</h2>
        <p>完成选择后，两边都可以输入，系统会自动翻译到另一边。</p>
      </div>

      <div className="language-choice-grid">
        <label className="language-choice">
          <span className="choice-label">语言 A</span>
          <span className="choice-content">
            <span className="choice-code">{leftLanguageDetails.shortCode}</span>
            <select
              value={leftLanguage}
              onChange={(event) => onLeftLanguageChange(event.target.value as LanguageCode)}
              aria-label="选择语言 A"
            >
              {LANGUAGES.map((language) => (
                <option
                  key={language.code}
                  value={language.code}
                  disabled={language.code === rightLanguage}
                >
                  {language.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <button
          type="button"
          className="setup-swap-button"
          onClick={onSwap}
          aria-label="交换已选择的两种语言"
          title="交换语言"
        >
          <SwapIcon />
        </button>

        <label className="language-choice">
          <span className="choice-label">语言 B</span>
          <span className="choice-content">
            <span className="choice-code">{rightLanguageDetails.shortCode}</span>
            <select
              value={rightLanguage}
              onChange={(event) => onRightLanguageChange(event.target.value as LanguageCode)}
              aria-label="选择语言 B"
            >
              {LANGUAGES.map((language) => (
                <option
                  key={language.code}
                  value={language.code}
                  disabled={language.code === leftLanguage}
                >
                  {language.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      <div className="setup-summary">
        <span>即将开启</span>
        <strong>
          {leftLanguageDetails.label} ↔ {rightLanguageDetails.label}
        </strong>
      </div>

      <button type="button" className="start-button" onClick={onStart}>
        开始双向翻译
        <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}

type LanguagePanelProps = {
  side: PanelSide
  language: LanguageCode
  value: string
  isActive: boolean
  isSourceTranslating: boolean
  showTargetProgress: boolean
  copied: boolean
  onTextChange: (value: string) => void
  onCopy: () => void
}

function LanguagePanel({
  side,
  language,
  value,
  isActive,
  isSourceTranslating,
  showTargetProgress,
  copied,
  onTextChange,
  onCopy,
}: LanguagePanelProps) {
  const languageDetails = getLanguage(language)
  const isLeft = side === 'left'
  const panelTitle = isLeft ? '语言 A' : '语言 B'

  return (
    <section
      className={`language-panel ${isActive ? 'is-active' : ''}`}
      aria-label={`${panelTitle}：${languageDetails.label}`}
    >
      <div className="language-toolbar">
        <div>
          <span className="panel-eyebrow">{panelTitle}</span>
          <div className="panel-language-name">
            <span className="language-short-code">{languageDetails.shortCode}</span>
            <strong>{languageDetails.label}</strong>
          </div>
        </div>
        <span className={`input-badge ${isActive ? 'is-visible' : ''}`}>
          {isSourceTranslating ? '正在翻译' : '当前输入端'}
        </span>
      </div>

      <div className="textarea-wrap">
        <textarea
          value={value}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={`输入${languageDetails.label}…`}
          aria-label={`${languageDetails.label}文本`}
          dir="auto"
          spellCheck
        />
        {showTargetProgress ? <div className="translation-shimmer" /> : null}
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
  const [languageFlow, setLanguageFlow] = useState<LanguageFlow>({
    step: 'selecting',
    leftLanguage: DEFAULT_LEFT_LANGUAGE,
    rightLanguage: DEFAULT_RIGHT_LANGUAGE,
  })
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [activeSide, setActiveSide] = useState<PanelSide>('left')
  const [translationJob, setTranslationJob] = useState<TranslationJob | null>(null)
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>({ state: 'idle' })
  const [copiedSide, setCopiedSide] = useState<PanelSide | null>(null)
  const nextJobId = useRef(0)
  const latestJobId = useRef(0)
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { leftLanguage, rightLanguage } = languageFlow

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

  function resetTranslation() {
    latestJobId.current = ++nextJobId.current
    setLeftText('')
    setRightText('')
    setActiveSide('left')
    setTranslationJob(null)
    setTranslationStatus({ state: 'idle' })
    setCopiedSide(null)
  }

  function queueTranslation(sourceSide: PanelSide, sourceText: string) {
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
      sourceLanguage: sourceSide === 'left' ? leftLanguage : rightLanguage,
      targetLanguage: sourceSide === 'left' ? rightLanguage : leftLanguage,
    })
  }

  function handleSetupLanguageChange(side: PanelSide, language: LanguageCode) {
    if (languageFlow.step !== 'selecting') {
      return
    }

    setLanguageFlow({
      ...languageFlow,
      leftLanguage: side === 'left' ? language : languageFlow.leftLanguage,
      rightLanguage: side === 'right' ? language : languageFlow.rightLanguage,
    })
  }

  function handleSetupSwap() {
    if (languageFlow.step !== 'selecting') {
      return
    }

    setLanguageFlow({
      step: 'selecting',
      leftLanguage: languageFlow.rightLanguage,
      rightLanguage: languageFlow.leftLanguage,
    })
  }

  function handleStartTranslation() {
    if (languageFlow.step !== 'selecting' || leftLanguage === rightLanguage) {
      return
    }

    resetTranslation()
    setLanguageFlow({ step: 'translating', leftLanguage, rightLanguage })
  }

  function handleReselectLanguages() {
    resetTranslation()
    setLanguageFlow({ step: 'selecting', leftLanguage, rightLanguage })
  }

  function handleTextChange(side: PanelSide, rawValue: string) {
    if (languageFlow.step !== 'translating') {
      return
    }

    const value = trimToUtf8ByteLimit(rawValue, MAX_SOURCE_BYTES)
    setActiveSide(side)

    if (side === 'left') {
      setLeftText(value)
    } else {
      setRightText(value)
    }
    queueTranslation(side, value)
  }

  function handleWorkspaceSwap() {
    if (languageFlow.step !== 'translating') {
      return
    }

    latestJobId.current = ++nextJobId.current
    setLanguageFlow({
      step: 'translating',
      leftLanguage: rightLanguage,
      rightLanguage: leftLanguage,
    })
    setLeftText(rightText)
    setRightText(leftText)
    setActiveSide(activeSide === 'left' ? 'right' : 'left')
    setTranslationJob(null)
    setTranslationStatus({ state: 'idle' })
  }

  function handleClear() {
    resetTranslation()
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
  const leftLanguageDetails = getLanguage(leftLanguage)
  const rightLanguageDetails = getLanguage(rightLanguage)

  return (
    <div className="app-shell">
      <header className="site-header">
        <button
          type="button"
          className="brand"
          onClick={handleReselectLanguages}
          aria-label="Dualingo 首页"
        >
          <span className="brand-mark" aria-hidden="true">
            <span>文</span>
            <span>A</span>
          </span>
          <span>Dualingo</span>
        </button>
        <span className="header-caption">
          {languageFlow.step === 'selecting' ? '先选择语言' : '双向即时翻译'}
        </span>
      </header>

      <main>
        {languageFlow.step === 'selecting' ? (
          <>
            <div className="intro setup-intro">
              <span className="intro-pill">先选语言，再开始</span>
              <h1>你想翻译哪两种语言？</h1>
              <p>先确定语言组合，下一步即可从任意一边输入并自动翻译。</p>
            </div>
            <LanguageSetup
              leftLanguage={leftLanguage}
              rightLanguage={rightLanguage}
              onLeftLanguageChange={(language) => handleSetupLanguageChange('left', language)}
              onRightLanguageChange={(language) => handleSetupLanguageChange('right', language)}
              onSwap={handleSetupSwap}
              onStart={handleStartTranslation}
            />
          </>
        ) : (
          <>
            <div className="intro workspace-intro">
              <span className="intro-pill">
                {leftLanguageDetails.label} ↔ {rightLanguageDetails.label}
              </span>
              <h1>任意一边输入，另一边自动翻译</h1>
              <p>两侧都是输入框；系统会以你最后输入的一侧作为原文。</p>
            </div>

            <div className="translator-card">
              <div className="workspace-header">
                <div className="workspace-language-pair">
                  <span>当前语言组合</span>
                  <strong>
                    {leftLanguageDetails.label}
                    <i>↔</i>
                    {rightLanguageDetails.label}
                  </strong>
                </div>
                <button type="button" className="edit-languages-button" onClick={handleReselectLanguages}>
                  <EditIcon />
                  重新选择语言
                </button>
              </div>

              <div className="translator-grid">
                <LanguagePanel
                  side="left"
                  language={leftLanguage}
                  value={leftText}
                  isActive={activeSide === 'left'}
                  isSourceTranslating={isTranslating && statusSourceSide === 'left'}
                  showTargetProgress={isTranslating && statusSourceSide === 'right'}
                  copied={copiedSide === 'left'}
                  onTextChange={(value) => handleTextChange('left', value)}
                  onCopy={() => void handleCopy('left')}
                />

                <div className="middle-actions">
                  <button
                    type="button"
                    className="swap-button"
                    onClick={handleWorkspaceSwap}
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
                  value={rightText}
                  isActive={activeSide === 'right'}
                  isSourceTranslating={isTranslating && statusSourceSide === 'right'}
                  showTargetProgress={isTranslating && statusSourceSide === 'left'}
                  copied={copiedSide === 'right'}
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
                    <span>两侧都可输入，约 0.5 秒后自动翻译</span>
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
          </>
        )}

        <p className="service-note">
          翻译由{' '}
          <a href="https://translate.google.com/" target="_blank" rel="noreferrer">
            Google Translate
          </a>{' '}
          提供。输入内容会发送给该服务处理，请勿输入敏感信息。
        </p>
      </main>

      <footer>Built for simple, focused translation.</footer>
    </div>
  )
}

export default App
