import cors from "cors";
import dotenv from "dotenv";
import gTTS from 'gtts';  // Import gTTS library for Text-to-Speech
import express from "express";
import { promises as fs } from "fs";
import axios from 'axios';  // Axios to handle local chatbot API calls
import * as THREE from "three"; // For morph target influences and interpolation

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',  // This allows all origins to access the resources
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // You can specify which HTTP methods are allowed
  allowedHeaders: ['Content-Type', 'Authorization']  // Specify which headers are allowed
}));
const port = 3000;

// Phoneme to Viseme mapping for morph target influences
const corresponding = {
  A: "viseme_PP",
  B: "viseme_kk",
  C: "viseme_I",
  D: "viseme_AA",
  E: "viseme_O",
  F: "viseme_U",
  G: "viseme_FF",
  H: "viseme_TH",
  X: "viseme_PP",
};

// Function to generate speech using gTTS and save it as an MP3 file
const generateSpeech = async (text, fileName) => {
  const gtts = new gTTS(text, 'en');
  return new Promise((resolve, reject) => {
    gtts.save(fileName, (err, result) => {
      if (err) reject(err);
      resolve(result);
    });
  });
};

// Function to generate random lip sync data
const generateRandomLipSync = () => {
  const phonemes = ["A", "B", "C", "D", "E", "F", "G", "H", "X"]; // Random phoneme placeholders
  const lipSyncData = [];
  const numEntries = Math.floor(Math.random() * 10) + 5; // Random number of entries between 5 and 15

  for (let i = 0; i < numEntries; i++) {
    lipSyncData.push({
      start: Math.random() * 3,  // Random start time within 3 seconds
      end: Math.random() * 3 + 1,  // Random end time within 4 seconds
      value: phonemes[Math.floor(Math.random() * phonemes.length)]
    });
  }

  return lipSyncData;
};

// Function to update morph targets based on lip sync data
const updateMorphTargets = (nodes, lipSyncData, currentTime, smoothMorphTarget, morphTargetSmoothing) => {
  Object.values(corresponding).forEach((value) => {
    if (!smoothMorphTarget) {
      nodes.Wolf3D_Head.morphTargetInfluences[nodes.Wolf3D_Head.morphTargetDictionary[value]] = 0;
      nodes.Wolf3D_Teeth.morphTargetInfluences[nodes.Wolf3D_Teeth.morphTargetDictionary[value]] = 0;
    } else {
      nodes.Wolf3D_Head.morphTargetInfluences[nodes.Wolf3D_Head.morphTargetDictionary[value]] = THREE.MathUtils.lerp(
        nodes.Wolf3D_Head.morphTargetInfluences[nodes.Wolf3D_Head.morphTargetDictionary[value]], 0, morphTargetSmoothing
      );
      nodes.Wolf3D_Teeth.morphTargetInfluences[nodes.Wolf3D_Teeth.morphTargetDictionary[value]] = THREE.MathUtils.lerp(
        nodes.Wolf3D_Teeth.morphTargetInfluences[nodes.Wolf3D_Teeth.morphTargetDictionary[value]], 0, morphTargetSmoothing
      );
    }
  });

  for (let i = 0; i < lipSyncData.length; i++) {
    const mouthCue = lipSyncData[i];
    if (currentTime >= mouthCue.start && currentTime <= mouthCue.end) {
      const viseme = corresponding[mouthCue.value];
      if (!smoothMorphTarget) {
        nodes.Wolf3D_Head.morphTargetInfluences[nodes.Wolf3D_Head.morphTargetDictionary[viseme]] = 1;
        nodes.Wolf3D_Teeth.morphTargetInfluences[nodes.Wolf3D_Teeth.morphTargetDictionary[viseme]] = 1;
      } else {
        nodes.Wolf3D_Head.morphTargetInfluences[nodes.Wolf3D_Head.morphTargetDictionary[viseme]] = THREE.MathUtils.lerp(
          nodes.Wolf3D_Head.morphTargetInfluences[nodes.Wolf3D_Head.morphTargetDictionary[viseme]], 1, morphTargetSmoothing
        );
        nodes.Wolf3D_Teeth.morphTargetInfluences[nodes.Wolf3D_Teeth.morphTargetDictionary[viseme]] = THREE.MathUtils.lerp(
          nodes.Wolf3D_Teeth.morphTargetInfluences[nodes.Wolf3D_Teeth.morphTargetDictionary[viseme]], 1, morphTargetSmoothing
        );
      }
      break;
    }
  }
};

// POST route to handle chat messages and generate the virtual girlfriend's response
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.mp3"), // Using MP3 file directly without conversion
          lipsync: generateRandomLipSync(), // Generating random lip sync data
          facialExpression: "smile",
          animation: "Talking_1", 
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.mp3"),
          lipsync: generateRandomLipSync(),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
    return;
  }

  try {
    // Call the external chatbot service
    const chatbotResponse = await axios.post('https://virtual-gf-py.vercel.app/chat', { message: userMessage });

    const messages = chatbotResponse.data;

    // Loop through the messages and generate audio data
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const fileName = `audios/message_${i}.mp3`; // The name of the audio file to generate

      // Generate speech using gTTS
      await generateSpeech(message.text, fileName);

      // Convert the audio file to Base64 and attach it to the message
      message.audio = await audioFileToBase64(fileName);

      // Attach random lip sync data to each message
      message.lipsync = generateRandomLipSync();
    }

    // Send the response back to the client
    res.send({ messages });

  } catch (error) {
    console.error('Error calling the external chatbot service:', error.message);

    if (error.response) {
      // The request was made and the server responded with a status code that falls out of the range of 2xx
      res.status(error.response.status).send({ error: error.response.data });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).send({ error: 'No response from chatbot service' });
    } else {
      // Something happened in setting up the request
      res.status(500).send({ error: 'Failed to process the request' });
    }
  }
});

// Helper function to convert audio files to base64 format
const audioFileToBase64 = async (file) => {
  try {
    const data = await fs.readFile(file);
    return data.toString("base64");
  } catch (error) {
    console.error("Error reading audio file:", error);
    throw error;
  }
};

// Start the server on the specified port
app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});
