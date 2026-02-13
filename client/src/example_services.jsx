// services.jsx - This file contains functions to call the backend API
// i think we can make separate files for each page but this is just here for the example right now
import axios from 'axios'

const API_URL = 'http://localhost:8080'

export const testApiCall = () => {
    return axios.get(`${API_URL}/api-test`)
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const getExamples = async () => {
    return await axios.get(`${API_URL}/api/example/`)
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const createExample = async (name, value) => {
    return await axios.post(`${API_URL}/api/example/`, { name, value })
        .then(res => res.data)
        .catch(err => console.error(err))
}