import axios from 'axios'

const API_URL = 'http://localhost:8080'

export const testApiCall = () => {
    return axios.get(`${API_URL}/api-test`)
        .then(res => res.data)
        .catch(err => console.error(err))
}