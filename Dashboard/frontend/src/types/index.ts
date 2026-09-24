export interface DaySummary {
  date: string
  score: number
  is_anomaly: boolean
  consumption_mean: number
}

export interface AnomalyAlert {
  date: string
  score: number
  threshold: number
  excess_pct: number
  severity: 'critical' | 'high' | 'moderate'
  day_of_week: string
  season: string
}

export interface WindowScore {
  start_minute: number
  end_minute: number
  score: number
  is_anomaly: boolean
}

export interface DayDetail {
  date: string
  score: number
  is_anomaly: boolean
  threshold: number
  original_signal: number[]
  reconstructed_signal: number[]
  window_scores: WindowScore[]
  hourly_errors: number[]
}

export interface HouseMeta {
  house_id: number
  name: string
  file_name: string
  available_days: number
}

export interface HouseSummary {
  house_id: number
  total_days: number
  normal_days: number
  anomalous_days: number
  anomaly_rate: number
  mean_score: number
  threshold: number
  timeline: DaySummary[]
}

export interface WeekdayStat {
  day: string
  normal_count: number
  anomaly_count: number
}

export interface SeasonStat {
  season: string
  normal_count: number
  anomaly_count: number
}

export interface ScoreDistribution {
  normal: number[]
  anomalous: number[]
}

export interface TopAnomaly {
  date: string
  score: number
}

export interface HouseStats {
  by_weekday: WeekdayStat[]
  by_season: SeasonStat[]
  score_distribution: ScoreDistribution
  top10_anomalies: TopAnomaly[]
}

export interface ComparisonRow {
  house_id: number
  total_days: number
  anomalous_days: number
  anomaly_rate: number
  mean_score: number
}

export interface AnomalyFilters {
  start_date?: string
  end_date?: string
  severity?: 'critical' | 'high' | 'moderate'
  season?: string
  day_of_week?: string
}
