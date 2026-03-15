export async function getWeatherForecast(lat, lon, date) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=weathercode,precipitation_probability&daily=temperature_2m_max&temperature_unit=fahrenheit&start_date=${date}&end_date=${date}`;
  
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather API error");
  
    const data = await res.json();
  
    // Daily high temperature
    const highTemp = data?.daily?.temperature_2m_max?.[0] ?? null;
  
    // Hourly data (may be missing!)
    const times = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
    const codes = Array.isArray(data?.hourly?.weathercode) ? data.hourly.weathercode : [];
    const precip = Array.isArray(data?.hourly?.precipitation_probability) ? data.hourly.precipitation_probability : [];
  
    // Find noon safely
    let noonIndex = -1;
  
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      if (typeof t === "string" && t.includes("T12")) {
        noonIndex = i;
        break;
      }
    }
  
    const index = noonIndex !== -1 ? noonIndex : 0;
  
    return {
      highTemp,
      weatherCode: codes[index] ?? null,
      precipitation: precip[index] ?? 0
    };
  }
  