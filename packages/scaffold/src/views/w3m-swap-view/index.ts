import { customElement } from '@web3modal/ui'
import { LitElement, html } from 'lit'
import { state } from 'lit/decorators.js'
import styles from './styles.js'
import {
  SwapController,
  RouterController,
  CoreHelperUtil,
  NetworkController,
  ModalController,
  ConstantsUtil,
  type SwapToken,
  type SwapInputTarget
} from '@web3modal/core'
import { NumberUtil } from '@web3modal/common'

@customElement('w3m-swap-view')
export class W3mSwapView extends LitElement {
  public static override styles = styles

  private unsubscribe: ((() => void) | undefined)[] = []

  // -- State & Properties -------------------------------- //
  @state() private interval?: NodeJS.Timeout

  @state() private detailsOpen = false

  @state() private caipNetworkId = NetworkController.state.caipNetwork?.id

  @state() private initialized = SwapController.state.initialized

  @state() private loading = SwapController.state.loading

  @state() private loadingPrices = SwapController.state.loadingPrices

  @state() private sourceToken = SwapController.state.sourceToken

  @state() private sourceTokenAmount = SwapController.state.sourceTokenAmount

  @state() private sourceTokenPriceInUSD = SwapController.state.sourceTokenPriceInUSD

  @state() private toToken = SwapController.state.toToken

  @state() private toTokenAmount = SwapController.state.toTokenAmount

  @state() private toTokenPriceInUSD = SwapController.state.toTokenPriceInUSD

  @state() private inputError = SwapController.state.inputError

  @state() private gasPriceInUSD = SwapController.state.gasPriceInUSD

  @state() private priceImpact = SwapController.state.priceImpact

  @state() private maxSlippage = SwapController.state.maxSlippage

  @state() private providerFee = SwapController.state.providerFee

  @state() private transactionLoading = SwapController.state.transactionLoading

  @state() private networkTokenSymbol = SwapController.state.networkTokenSymbol

  @state() private fetchError = SwapController.state.fetchError

  // -- Lifecycle ----------------------------------------- //
  public constructor() {
    super()
    NetworkController.subscribeKey('caipNetwork', newCaipNetwork => {
      if (this.caipNetworkId !== newCaipNetwork?.id) {
        this.caipNetworkId = newCaipNetwork?.id
        SwapController.resetState()
        SwapController.initializeState()
      }
    })
    this.unsubscribe.push(
      ...[
        ModalController.subscribeKey('open', isOpen => {
          if (!isOpen) {
            SwapController.resetState()
          }
        }),
        RouterController.subscribeKey('view', newRoute => {
          if (!newRoute.includes('Swap')) {
            SwapController.resetValues()
          }
        }),
        SwapController.subscribe(newState => {
          this.initialized = newState.initialized
          this.loading = newState.loading
          this.loadingPrices = newState.loadingPrices
          this.transactionLoading = newState.transactionLoading
          this.sourceToken = newState.sourceToken
          this.sourceTokenAmount = newState.sourceTokenAmount
          this.sourceTokenPriceInUSD = newState.sourceTokenPriceInUSD
          this.toToken = newState.toToken
          this.toTokenAmount = newState.toTokenAmount
          this.toTokenPriceInUSD = newState.toTokenPriceInUSD
          this.inputError = newState.inputError
          this.gasPriceInUSD = newState.gasPriceInUSD
          this.priceImpact = newState.priceImpact
          this.maxSlippage = newState.maxSlippage
          this.providerFee = newState.providerFee
          this.fetchError = newState.fetchError
        })
      ]
    )
  }

  public override firstUpdated() {
    SwapController.initializeState()
    this.watchTokensAndValues()
  }

  public override disconnectedCallback() {
    this.unsubscribe.forEach(unsubscribe => unsubscribe?.())
    clearInterval(this.interval)
  }

  // -- Render -------------------------------------------- //
  public override render() {
    return html`
      <wui-flex flexDirection="column" .padding=${['0', 'l', 'l', 'l']} gap="s">
        ${this.initialized ? this.templateSwap() : this.templateLoading()}
      </wui-flex>
    `
  }

  // -- Private ------------------------------------------- //
  private watchTokensAndValues() {
    this.interval = setInterval(() => {
      SwapController.getNetworkTokenPrice()
      SwapController.getMyTokensWithBalance()
      SwapController.swapTokens()
    }, 10_000)
  }

  private templateSwap() {
    return html`
      <wui-flex flexDirection="column" gap="l">
        <wui-flex flexDirection="column" alignItems="center" gap="xs" class="swap-inputs-container">
          ${this.templateTokenInput('sourceToken', this.sourceToken)}
          ${this.templateTokenInput('toToken', this.toToken)} ${this.templateReplaceTokensButton()}
        </wui-flex>
        ${this.templateDetails()} ${this.templateActionButton()}
      </wui-flex>
    `
  }

  private actionButtonLabel(): string {
    if (this.fetchError) {
      return 'Swap'
    }

    if (!this.sourceToken || !this.toToken) {
      return 'Select token'
    }

    if (!this.sourceTokenAmount) {
      return 'Enter amount'
    }

    if (!this.initialized) {
      return 'Swap'
    }

    if (this.inputError) {
      return this.inputError
    }

    return 'Review swap'
  }

  private templateReplaceTokensButton() {
    return html`
      <wui-flex class="replace-tokens-button-container">
        <button @click=${this.onSwitchTokens.bind(this)}>
          <wui-icon name="recycleHorizontal" color="fg-250" size="lg"></wui-icon>
        </button>
      </wui-flex>
    `
  }

  private templateLoading() {
    return html`
      <wui-flex flexDirection="column" gap="l">
        <wui-flex flexDirection="column" alignItems="center" gap="xs" class="swap-inputs-container">
          <w3m-swap-input-skeleton target="sourceToken"></w3m-swap-input-skeleton>
          <w3m-swap-input-skeleton target="toToken"></w3m-swap-input-skeleton>
          ${this.templateReplaceTokensButton()}
        </wui-flex>
        ${this.templateActionButton()}
      </wui-flex>
    `
  }

  private templateTokenInput(target: SwapInputTarget, token?: SwapToken) {
    const myToken = SwapController.state.myTokensWithBalance?.find(
      ct => ct?.address === token?.address
    )
    const amount = target === 'toToken' ? this.toTokenAmount : this.sourceTokenAmount
    const price = target === 'toToken' ? this.toTokenPriceInUSD : this.sourceTokenPriceInUSD
    let value = parseFloat(amount) * price

    if (target === 'toToken') {
      value -= this.gasPriceInUSD || 0
    }

    return html`<w3m-swap-input
      .value=${target === 'toToken' ? this.toTokenAmount : this.sourceTokenAmount}
      ?disabled=${this.loading && target === 'toToken'}
      .onSetAmount=${this.handleChangeAmount.bind(this)}
      target=${target}
      .token=${token}
      .balance=${myToken?.quantity?.numeric}
      .price=${myToken?.price}
      .marketValue=${value}
      .onSetMaxValue=${this.onSetMaxValue.bind(this)}
    ></w3m-swap-input>`
  }

  private onSetMaxValue(target: SwapInputTarget, balance: string | undefined) {
    const token = target === 'sourceToken' ? this.sourceToken : this.toToken
    const isNetworkToken = token?.address === ConstantsUtil.NATIVE_TOKEN_ADDRESS

    let value = '0'

    if (!balance) {
      value = '0'
      this.handleChangeAmount(target, value)

      return
    }

    if (!this.gasPriceInUSD) {
      value = balance
      this.handleChangeAmount(target, value)

      return
    }

    const amountOfTokenGasRequires = NumberUtil.bigNumber(this.gasPriceInUSD.toFixed(5)).dividedBy(
      this.sourceTokenPriceInUSD
    )
    const maxValue = isNetworkToken
      ? NumberUtil.bigNumber(balance).minus(amountOfTokenGasRequires)
      : NumberUtil.bigNumber(balance)

    this.handleChangeAmount(target, maxValue.isGreaterThan(0) ? maxValue.toFixed(20) : '0')
  }

  private templateDetails() {
    if (this.inputError) {
      return null
    }

    if (!this.sourceToken || !this.toToken || !this.sourceTokenAmount || !this.toTokenAmount) {
      return null
    }

    const toTokenSwappedAmount =
      this.sourceTokenPriceInUSD && this.toTokenPriceInUSD
        ? (1 / this.toTokenPriceInUSD) * this.sourceTokenPriceInUSD
        : 0

    return html`
      <w3m-swap-details
        .detailsOpen=${this.detailsOpen}
        sourceTokenSymbol=${this.sourceToken?.symbol}
        sourceTokenPrice=${this.sourceTokenPriceInUSD}
        toTokenSymbol=${this.toToken?.symbol}
        toTokenSwappedAmount=${toTokenSwappedAmount}
        toTokenAmount=${this.toTokenAmount}
        gasPriceInUSD=${this.gasPriceInUSD}
        .priceImpact=${this.priceImpact}
        slippageRate=${ConstantsUtil.CONVERT_SLIPPAGE_TOLERANCE}
        .maxSlippage=${this.maxSlippage}
        providerFee=${this.providerFee}
        networkTokenSymbol=${this.networkTokenSymbol}
      ></w3m-swap-details>
    `
  }

  private handleChangeAmount(target: SwapInputTarget, value: string) {
    SwapController.clearError()
    if (target === 'sourceToken') {
      SwapController.setSourceTokenAmount(value)
    } else {
      SwapController.setToTokenAmount(value)
    }
    this.onDebouncedGetSwapCalldata()
  }

  private templateActionButton() {
    const haveNoTokenSelected = !this.toToken || !this.sourceToken
    const haveNoAmount = !this.sourceTokenAmount
    const loading = this.loading || this.loadingPrices || this.transactionLoading
    const disabled = loading || haveNoTokenSelected || haveNoAmount || this.inputError

    return html` <wui-flex gap="xs">
      <wui-button
        class="action-button"
        fullWidth
        size="lg"
        borderRadius="xs"
        variant=${haveNoTokenSelected ? 'neutral' : 'main'}
        .loading=${loading}
        .disabled=${disabled}
        @click=${this.onSwapPreview}
      >
        ${this.actionButtonLabel()}
      </wui-button>
    </wui-flex>`
  }

  private onDebouncedGetSwapCalldata = CoreHelperUtil.debounce(async () => {
    await SwapController.swapTokens()
  }, 200)

  private onSwitchTokens() {
    SwapController.switchTokens()
  }

  private onSwapPreview() {
    if (this.fetchError) {
      SwapController.swapTokens()

      return
    }

    RouterController.push('SwapPreview')
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'w3m-swap-view': W3mSwapView
  }
}
