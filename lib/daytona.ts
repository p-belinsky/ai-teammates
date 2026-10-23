import { Daytona } from "@daytona/sdk"

// Passed explicitly: the SDK refuses to guess the endpoint when .env.local and the process env both name one
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})
