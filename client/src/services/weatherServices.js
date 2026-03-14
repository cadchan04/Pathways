export async function getWeatherForecast(lat, lon, date) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&temperature_unit=fahrenheit&start_date=${date}&end_date=${date}`;
  
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather API error");
  
    const data = await res.json();
  
    const noonIndex = data.hourly.time.findIndex(t => t.includes("T12"));
    const index = noonIndex !== -1 ? noonIndex : 0;
  
    return {
      temperature: data.hourly.temperature_2m[index],
      weatherCode: data.hourly.weathercode[index]
    };
  }
  