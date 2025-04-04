console.log("AI Prompt Privacy Protector content script loaded.");

async function processPrompt(prompt) {
  console.log("Processing prompt (original):", prompt); // Log the original prompt

  // Basic Regex for Sensitive Data
  const sensitiveData = {};
  const patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  };

  let processedPrompt = prompt;
  for (const key in patterns) {
    const matches = processedPrompt.matchAll(patterns[key]);
    for (const match of matches) {
      const original = match[0];
      const encrypted = await encryptData(original);
      sensitiveData[original] = encrypted;
      processedPrompt = processedPrompt.replace(original, `[ENCRYPTED:${key}]`);
    }
  }

  console.log("Identified and encrypted:", sensitiveData);
  return { encryptedPrompt: processedPrompt, originalData: sensitiveData };
}

async function encryptData(data) {
  console.log("Encrypting data:", data);
  try {
    const keyMaterial = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    console.log("Key generated successfully.");
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    console.log("IV generated:", iv);
    const encodedData = new TextEncoder().encode(data);
    console.log("Encoded data:", encodedData);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      keyMaterial,
      encodedData
    );
    console.log("Encryption successful:", ciphertext);
    const ivArray = Array.from(iv);
    const ciphertextArray = Array.from(new Uint8Array(ciphertext));
    const combined = ivArray.concat(ciphertextArray);
    const base64Result = btoa(String.fromCharCode.apply(null, combined));
    console.log("Base64 encrypted data:", base64Result);
    return base64Result;
  } catch (error) {
    console.error("Encryption error:", error);
    return null;
  }
}

function setupPromptListener() {
  const promptTextarea = document.getElementById("prompt-textarea");
  if (promptTextarea) {
    console.log("Prompt textarea found by MutationObserver.");
    let currentPrompt = ""; // Store the latest prompt value

    // Create encrypt button
    const encryptButton = document.createElement("button");
    encryptButton.textContent = "Encrypt";
    encryptButton.id = "encrypt-button";
    encryptButton.type = "button"; // Explicitly set type to prevent form submission
    encryptButton.style.cssText = `
      position: absolute;
      right: 70px; 
      bottom: 12px;
      background-color: #10a37f;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: pointer;
      z-index: 1000;
      transition: background-color 0.2s;
    `;
    encryptButton.onmouseover = () => {
      encryptButton.style.backgroundColor = "#0d8a6c";
    };
    encryptButton.onmouseout = () => {
      encryptButton.style.backgroundColor = "#10a37f";
    };

    // Find the parent container for positioning
    const parentContainer = promptTextarea.closest(".relative");
    if (parentContainer) {
      parentContainer.style.position = "relative";
      parentContainer.appendChild(encryptButton);
    } else {
      // Fallback - add directly after textarea
      promptTextarea.parentNode.insertBefore(
        encryptButton,
        promptTextarea.nextSibling
      );
      encryptButton.style.position = "fixed";
    }

    // Add event listeners
    promptTextarea.addEventListener("input", (event) => {
      currentPrompt = promptTextarea.value || promptTextarea.textContent;
      // Toggle encrypt button visibility based on content
      encryptButton.style.display = currentPrompt ? "block" : "none";
    });

    // Encrypt button click handler
    // Encrypt button click handler
    encryptButton.addEventListener("click", async (event) => {
      // Prevent any default button behavior and stop event propagation
      event.preventDefault();
      event.stopPropagation();

      const originalPrompt = promptTextarea.value || promptTextarea.textContent;
      if (!originalPrompt) return;

      console.log("Encrypt button clicked, processing:", originalPrompt);
      const result = await processPrompt(originalPrompt);

      if (result && Object.keys(result.originalData).length > 0) {
        console.log("Sensitive data found, replacing with encrypted version");

        // Replace textarea content
        promptTextarea.value = result.encryptedPrompt;
        promptTextarea.textContent = result.encryptedPrompt;

        setTimeout(() => {
          // Force ChatGPT to recognize the change without triggering submission
          const inputEvent = new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: "insertText",
          });
          promptTextarea.dispatchEvent(inputEvent);

          console.log("Textarea content replaced with encrypted version");
        }, 10);
      } else {
        console.log("No sensitive data found to encrypt");
      }
    });

    // Initial button state - hide if textarea is empty
    encryptButton.style.display = promptTextarea.value ? "block" : "none";

    observer.disconnect();
  }
}

// Keep the rest of your code as is, but remove or comment out the keydown event handler
// since we're replacing it with the button approach

// Create a Mutation Observer
const observer = new MutationObserver((mutationsList, observer) => {
  setupPromptListener();
});

observer.observe(document.body, { childList: true, subtree: true });

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const url = args[0];
  const options = args[1] || {};
  let body = options.body;

  if (url.includes("chatgpt.com/backend-api/conversation")) {
    if (typeof body === "string") {
      try {
        const parsedBody = JSON.parse(body);
        if (parsedBody && typeof parsedBody.prompt === "string") {
          const { encryptedPrompt, originalData } = await processPrompt(
            parsedBody.prompt
          );
          if (Object.keys(originalData).length > 0) {
            parsedBody.prompt = encryptedPrompt;
            options.body = JSON.stringify(parsedBody);
            console.log(
              "Modified fetch request to /conversation:",
              options.body
            );
          }
        } else if (parsedBody && Array.isArray(parsedBody.messages)) {
          for (const message of parsedBody.messages) {
            if (message && typeof message.content === "string") {
              const { encryptedPrompt, originalData } = await processPrompt(
                message.content
              );
              if (Object.keys(originalData).length > 0) {
                message.content = encryptedPrompt;
                options.body = JSON.stringify(parsedBody);
                console.log(
                  "Modified fetch request to /conversation (messages):",
                  options.body
                );
                break;
              }
            }
          }
        }
      } catch (e) {
        console.error("Error parsing or processing fetch body:", e);
      }
    }
  }

  return originalFetch.apply(this, args);
};
