import axios from 'axios'
import type {
  AnomalyAlert,
  AnomalyFilters,
  ComparisonRow,
  DayDetail,
  HouseMeta,
  HouseStats,
  HouseSummary,
} from '../types'

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 30000,
})

export async function getHouses(): Promise<HouseMeta[]> {
  const { data } = await api.get<HouseMeta[]>('/houses')
  return data
}

export async function getHouseSummary(id: number): Promise<HouseSummary> {
  const { data } = await api.get<HouseSummary>(`/houses/${id}/summary`)
  return data
}

export async function getAnomalies(id: number, filters: AnomalyFilters = {}): Promise<AnomalyAlert[]> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  })

  const { data } = await api.get<AnomalyAlert[]>(`/houses/${id}/anomalies`, { params })
  return data
}

export async function getDayDetail(id: number, date: string): Promise<DayDetail> {
  const { data } = await api.get<DayDetail>(`/houses/${id}/day/${date}`)
  return data
}

export async function getStats(id: number): Promise<HouseStats> {
  const { data } = await api.get<HouseStats>(`/houses/${id}/stats`)
  return data
}

export async function getComparison(): Promise<ComparisonRow[]> {
  const { data } = await api.get<ComparisonRow[]>('/comparison')
  return data
}
