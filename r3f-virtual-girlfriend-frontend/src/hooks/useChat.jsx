import { createContext, useContext, useEffect, useState } from "react";

 const backendUrl = "https://virtual-gf-js.vercel.app";

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const chat = async (message) => {
    setLoading(true);
  
    // Check if the message contains "@user" to determine which URL to use
    const url = message.includes("@user")
      ? "https://virtual-gf-py.vercel.app/sofi/chat"
      : `${backendUrl}/chat`;
      console.log(url);
    const data = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
  
    const resp = (await data.json()).messages;
    console.log("==============");
    console.log(data);
    console.log(resp);
    console.log("==============");
    setMessages((messages) => [...messages, ...resp]);
    setLoading(false);
  };
  
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState();
  const [loading, setLoading] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(true);
  const onMessagePlayed = () => {
    setMessages((messages) => messages.slice(1));
  };

  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
    } else {
      setMessage(null);
    }
  }, [messages]);

  return (
    <ChatContext.Provider
      value={{
        chat,
        message,
        onMessagePlayed,
        loading,
        cameraZoomed,
        setCameraZoomed,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  console.log(context);
  const messageText = context.message && context.message.text ? context.message.text : "";
  console.log("Message text:", messageText);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  
  return { ...context, messageText };
};
