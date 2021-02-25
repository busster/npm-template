import axios from 'axios'

axios.interceptors.response.use(response => response, error => error)

export const HttpMethods = {
  GET: 'Get',
  POST: 'Post',
  PUT: 'Put',
  DELETE: 'Delete'
}

export class HttpRequest {
  constructor ({ url, body, headers, queryParams, responseType }) {
    this.Url = url
    this.Data = body
    this.Headers = headers || {}
    this.Params = queryParams
    this.ResponseType = responseType
  }

  addHeader (key, value) {
    this.Headers[key] = value
  }
}

export const HttpClient = {
  [HttpMethods.GET]: async (request) =>
    await axios({
      url: request.Url,
      params: request.Params,
      responseType: request.ResponseType,
      headers: request.Headers,
      method: 'GET'
    }),
  [HttpMethods.POST]: async (request) =>
    await axios({
      url: request.Url,
      data: request.Data,
      headers: request.Headers,
      method: 'POST'
    }),
  [HttpMethods.PUT]: async (request) =>
    await axios({
      url: request.Url,
      data: request.Data,
      params: request.Params,
      headers: request.Headers,
      method: 'PUT'
    }),
  [HttpMethods.DELETE]: async (request) =>
    await axios({
      url: request.Url,
      data: request.Data,
      params: request.Params,
      headers: request.Headers,
      method: 'DELETE'
    })
}
