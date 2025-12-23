import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes a screenshot of a ride-sharing app using Gemini.
 */
export const analyzeScreenshot = async (base64Image: string): Promise<AnalysisResult> => {
  // Using gemini-3-flash-preview for multimodal text extraction tasks
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analiza esta captura de pantalla. 
    ¿Es una oferta de viaje activa de una app de conductor (Uber, Didi, Bolt, InDrive)?
    
    Si NO es una oferta de viaje clara (por ejemplo, es un mapa sin precio, un menú, o una lista), devuelve JSON con "valid": false y los demás valores en 0.

    Si SI es una oferta, extrae:
    1. **Precio total** del viaje.
    2. **Distancia de recogida** (distancia para ir a buscar al pasajero).
    3. **Distancia del viaje** (distancia desde recogida hasta destino).
    4. **Tiempo de recogida** (minutos).
    5. **Tiempo del viaje** (minutos).

    Reglas:
    - "valid": true si encontraste los datos.
    - Suma distancias para 'totalKm' y tiempos para 'totalTimeMinutes'.
    - Si hay rangos (5-7 min), usa el promedio.
    - Devuelve SOLO JSON.

    Ejemplo JSON:
    {
      "valid": true,
      "totalPrice": 5500,
      "pickupKm": 1.5,
      "tripKm": 10.2,
      "pickupMinutes": 5,
      "tripMinutes": 25,
      "currency": "$"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            valid: { type: Type.BOOLEAN },
            totalPrice: { type: Type.NUMBER },
            pickupKm: { type: Type.NUMBER },
            tripKm: { type: Type.NUMBER },
            pickupMinutes: { type: Type.NUMBER },
            tripMinutes: { type: Type.NUMBER },
            currency: { type: Type.STRING },
          },
          required: ["valid", "totalPrice", "pickupKm", "tripKm", "pickupMinutes", "tripMinutes", "currency"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text);

    return {
      valid: data.valid,
      totalPrice: data.totalPrice || 0,
      pickupKm: data.pickupKm || 0,
      tripKm: data.tripKm || 0,
      totalKm: (data.pickupKm || 0) + (data.tripKm || 0),
      pickupMinutes: data.pickupMinutes || 0,
      tripMinutes: data.tripMinutes || 0,
      totalTimeMinutes: (data.pickupMinutes || 0) + (data.tripMinutes || 0),
      currency: data.currency || "$",
    };

  } catch (error) {
    console.error("Error analysing image:", error);
    // Return an invalid result instead of throwing, so the loop continues
    return {
      valid: false,
      totalPrice: 0,
      pickupKm: 0,
      tripKm: 0,
      totalKm: 0,
      pickupMinutes: 0,
      tripMinutes: 0,
      totalTimeMinutes: 0,
      currency: "$",
    };
  }
};