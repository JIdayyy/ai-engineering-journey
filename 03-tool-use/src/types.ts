export interface WeatherResponse {
  current_condition: CurrentCondition[];
  nearest_area: NearestArea[];
  request: Request[];
  weather: Weather[];
}

export interface CurrentCondition {
  FeelsLikeC: string;
  FeelsLikeF: string;
  cloudcover: string;
  humidity: string;
  lang_fr: LangFr[];
  lang_xx: LangXx[];
  observation_time: string;
  precipInches: string;
  precipMM: string;
  pressure: string;
  pressureInches: string;
  temp_C: string;
  temp_F: string;
  uvIndex: string;
  visibility: string;
  visibilityMiles: string;
  weatherCode: string;
  weatherDesc: WeatherDesc[];
  weatherIconUrl: WeatherIconUrl[];
  winddir16Point: string;
  winddirDegree: string;
  windspeedKmph: string;
  windspeedMiles: string;
}

export interface LangFr {
  value: string;
}

export interface LangXx {
  value: string;
}

export interface WeatherDesc {
  value: string;
}

export interface WeatherIconUrl {
  value: string;
}

export interface NearestArea {
  areaName: AreaName[];
  country: Country[];
  latitude: string;
  longitude: string;
  population: string;
  region: Region[];
  weatherUrl: WeatherUrl[];
}

export interface AreaName {
  value: string;
}

export interface Country {
  value: string;
}

export interface Region {
  value: string;
}

export interface WeatherUrl {
  value: string;
}

export interface Request {
  query: string;
  type: string;
}

export interface Weather {
  astronomy: Astronomy[];
  avgtempC: string;
  avgtempF: string;
  date: string;
  hourly: Hourly[];
  maxtempC: string;
  maxtempF: string;
  mintempC: string;
  mintempF: string;
  sunHour: string;
  totalSnow_cm: string;
  uvIndex: string;
}

export interface Astronomy {
  moon_illumination: string;
  moon_phase: string;
  moonrise: string;
  moonset: string;
  sunrise: string;
  sunset: string;
}

export interface Hourly {
  DewPointC: string;
  DewPointF: string;
  FeelsLikeC: string;
  FeelsLikeF: string;
  HeatIndexC: string;
  HeatIndexF: string;
  WindChillC: string;
  WindChillF: string;
  WindGustKmph: string;
  WindGustMiles: string;
  chanceoffog: string;
  chanceoffrost: string;
  chanceofhightemp: string;
  chanceofovercast: string;
  chanceofrain: string;
  chanceofremdry: string;
  chanceofsnow: string;
  chanceofsunshine: string;
  chanceofthunder: string;
  chanceofwindy: string;
  cloudcover: string;
  diffRad: string;
  humidity: string;
  lang_fr: LangFr2[];
  lang_xx: LangXx2[];
  precipInches: string;
  precipMM: string;
  pressure: string;
  pressureInches: string;
  shortRad: string;
  tempC: string;
  tempF: string;
  time: string;
  uvIndex: string;
  visibility: string;
  visibilityMiles: string;
  weatherCode: string;
  weatherDesc: WeatherDesc2[];
  weatherIconUrl: WeatherIconUrl2[];
  winddir16Point: string;
  winddirDegree: string;
  windspeedKmph: string;
  windspeedMiles: string;
}

export interface LangFr2 {
  value: string;
}

export interface LangXx2 {
  value: string;
}

export interface WeatherDesc2 {
  value: string;
}

export interface WeatherIconUrl2 {
  value: string;
}

export interface WorldTimeApiResponse {
  abbreviation: string;
  datetime: string;
  day_of_week: number;
  day_of_year: number;
  dst: boolean;
  dst_from: string;
  dst_offset: number;
  dst_until: string;
  raw_offset: number;
  timezone: string;
  unixtime: number;
  utc_datetime: string;
  utc_offset: string;
  week_number: number;
}
