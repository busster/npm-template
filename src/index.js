import { HttpMethods, HttpClient, HttpRequest } from './client'

import _isFunction from 'lodash/isFunction'

const isAFailedHttpResponse = (res) => {
  return (res === undefined || !/2[0-9][0-9]/.test(res.status || (res.response && res.response.status)))
}

const noop = () => {}

const methodInvalid = (method) => method === null || !Object.values(HttpMethods).includes(method)

const strategiesInvalid = (strategies) => !strategies.every(_isFunction)

const unauthorized = (res) => {
  return /401/.test(res && (res.status || (res.response && res.response.status)))
}

const noContent = (res) => {
  return /204/.test(res.status)
}

const warnAndInvalidate = (message) => {
  console.warn(message)
  return false
}

const validConfiguration = ({
  method,
  url,
  headers,
  bearer,
  queryParams,
  // responseType,
  // body,
  maxRetry,
  retryFallbackStrategy,
  unauthorizedStrategy,
  failedStrategy,
  noContentStrategy,
  successStrategy,
  failedSideEffects,
  successSideEffects,
  refreshTokenStrategy
}) => {
  if (methodInvalid(method)) {
    return warnAndInvalidate('Http method not defined or is invalid')
  }
  if (!url) {
    return warnAndInvalidate('No url configured')
  }
  if (typeof headers !== 'object') {
    return warnAndInvalidate('Headers must be an object')
  }
  if (typeof queryParams !== 'object') {
    return warnAndInvalidate('Parameters must be an object')
  }
  if (typeof maxRetry !== 'number') {
    return warnAndInvalidate('Max retries must be a number')
  }
  const strategies = [retryFallbackStrategy, unauthorizedStrategy, failedStrategy, noContentStrategy, successStrategy, ...failedSideEffects, ...successSideEffects, refreshTokenStrategy]
  if (strategiesInvalid(strategies)) {
    return warnAndInvalidate('Strategies must be functions')
  }

  return true
}

const call = async (configuration, retry = 0) => {
  // build request object
  const request = new HttpRequest({
    url: configuration.url,
    body: configuration.body,
    headers: configuration.headers,
    queryParams: configuration.queryParams,
    responseType: configuration.responseType
  })
  // handle retries
  if (retry >= configuration.maxRetry) {
    configuration.retryFallbackSideEffects.forEach(rfse => rfse(request))
    return await configuration.retryFallbackStrategy(request)
  }
  // configure final request with auth headers
  if (configuration.bearer) request.addHeader('Authorization', `Bearer ${configuration.bearer}`)
  // make request
  const response = await HttpClient[configuration.method](request)
  if (unauthorized(response)) { // handle unauthorized
    // try to refresh token
    if (await configuration.refreshTokenStrategy()) {
      return await call(configuration, retry + 1)
    } else {
      // is unauthorized
      configuration.unauthorizedSideEffects.forEach(useff => useff(response))
      return await configuration.unauthorizedStrategy(response)
    }
  } else if (isAFailedHttpResponse(response)) { // handle failed
    // execute failed side effects
    configuration.failedSideEffects.forEach(fse => fse(response))
    return await configuration.failedStrategy(response)
  }
  // execute success side effects
  configuration.successSideEffects.forEach(sse => sse(response))
  const successStrategy = noContent(response) ? configuration.noContentStrategy : configuration.successStrategy
  return await successStrategy(response) // handle success
}

export class HttpBuilder {
  constructor () {
    this.method = null
    this.url = null
    this.bearer = null
    this.headers = {}
    this.queryParams = null
    this.responseType = null
    this.body = null
    this.maxRetry = 2

    this.retryFallbackStrategy = noop
    this.unauthorizedStrategy = noop
    this.failedStrategy = () => false
    this.noContentStrategy = () => true
    this.successStrategy = (res) => res.data

    this.retryFallbackSideEffects = []
    this.unauthorizedSideEffects = []
    this.failedSideEffects = []
    this.successSideEffects = []

    this.refreshTokenStrategy = () => false
  }

  // CONFIGURE METHOD
  asGet () {
    this.method = HttpMethods.GET
    return this
  }
  asPost () {
    this.method = HttpMethods.POST
    return this
  }
  asPut () {
    this.method = HttpMethods.PUT
    return this
  }
  asDelete () {
    this.method = HttpMethods.DELETE
    return this
  }

  // CONFIGURE URL
  withUrl (url) {
    this.url = url
    return this
  }

  // CONFIGURE HEADERS
  withAuthorization (bearer) {
    this.bearer = bearer
    return this
  }
  withHeaders (headers) {
    this.headers = headers
    return this
  }

  // CONFIGURE PARAMS
  withParams (params) {
    this.queryParams = params
    return this
  }

  // CONFIGURE RESPONSE TYPE
  withResponseType (responseType) {
    this.responseType = responseType
    return this
  }

  // CONFIGURE BODY
  withBody (body) {
    this.body = body
    return this
  }

  // RETRY
  withMaxRetries (retries) {
    this.maxRetry = retries
  }

  // CONFIGURE STRATEGIES
  withRetryFallbackStrategy (strategy) {
    this.retryFallbackStrategy = strategy
    return this
  }
  withUnauthorizedStrategy (strategy) {
    this.unauthorizedStrategy = strategy
    return this
  }
  withFailedStrategy (strategy) {
    this.failedStrategy = strategy
    return this
  }
  withNoContentStrategy (strategy) {
    this.noContentStrategy = strategy
    return this
  }
  withSuccessStrategy (strategy) {
    this.successStrategy = strategy
    return this
  }

  // CONFIGURE SIDE EFFECTS
  withRetryFallbackSideEffects (strategy) {
    this.retryFallbackSideEffects.push(strategy)
    return this
  }
  withUnauthorizedSideEffects (strategy) {
    this.unauthorizedSideEffects.push(strategy)
    return this
  }
  withFailedSideEffect (strategy) {
    this.failedSideEffects.push(strategy)
    return this
  }
  withSuccessSideEffect (strategy) {
    this.successSideEffects.push(strategy)
    return this
  }

  // TO BE CALLED WHEN IN NEED OF A TOKEN REFRESH
  // (should return a bool)
  withRefreshTokenStrategy (strategy) {
    this.refreshTokenStrategy = strategy
    return this
  }

  // VALIDATE CONFIGURATION AND PERFORM REQUEST
  async send () {
    const configuration = {
      method: this.method,
      url: this.url,
      headers: this.headers,
      bearer: this.bearer,
      queryParams: this.queryParams,
      responseType: this.responseType,
      body: this.body,
      maxRetry: this.maxRetry,
      retryFallbackStrategy: this.retryFallbackStrategy,
      unauthorizedStrategy: this.unauthorizedStrategy,
      failedStrategy: this.failedStrategy,
      noContentStrategy: this.noContentStrategy,
      successStrategy: this.successStrategy,
      refreshTokenStrategy: this.refreshTokenStrategy,
      failedSideEffects: this.failedSideEffects,
      successSideEffects: this.successSideEffects,
      unauthorizedSideEffects: this.unauthorizedSideEffects,
      retryFallbackSideEffects: this.retryFallbackSideEffects
    }
    if (validConfiguration(configuration)) return await call(configuration)
  }
}
