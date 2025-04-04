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
      { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
    console.log("Key generated successfully.");
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    console.log("IV generated:", iv);
    const encodedData = new TextEncoder().encode(data);
    console.log("Encoded data:", encodedData);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv }, keyMaterial, encodedData
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
  const promptTextarea = document.getElementById('prompt-textarea');
  if (promptTextarea) {
    console.log("Prompt textarea found by MutationObserver.");
    let currentPrompt = ""; // Store the latest prompt value

    promptTextarea.addEventListener('input', (event) => {
      currentPrompt = promptTextarea.textContent;
      console.log("Input event triggered, current prompt:", currentPrompt);
    });

    promptTextarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        (async () => {
          // Store the original prompt
          const originalPrompt = currentPrompt;
          
          // Process to check for sensitive data
          const result = await processPrompt(originalPrompt);
          
          if (result && Object.keys(result.originalData).length > 0) {
            event.preventDefault();
            event.stopPropagation();
            
            console.log("Sensitive data found, replacing with encrypted version");
            
            // Replace textarea content
            promptTextarea.value = result.encryptedPrompt;
            promptTextarea.textContent = result.encryptedPrompt;
            
            // Force ChatGPT to recognize the change
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            promptTextarea.dispatchEvent(inputEvent);
            
            console.log("Looking for send button...");
            
            const form = promptTextarea.closest('form');
            let sendButton;
            
            if (form) {
              sendButton = form.querySelector('button[type="submit"]');
            }
            
            if (!sendButton) {
              sendButton = document.querySelector('#composer-submit-button');
            }
            
            if (!sendButton) {
              sendButton = document.querySelector('button[data-testid="send-button"]');
            }
            
            if (!sendButton) {
              sendButton = document.querySelector('.absolute.right-3.bottom-0 button');
            }
            
            console.log("Total buttons found:", document.querySelectorAll('button').length);
            
            if (sendButton) {
              console.log("Send button found:", sendButton);
              
              // Use a small delay and then click
              setTimeout(() => {
                console.log("Clicking send button...");
                sendButton.click();
              }, 100);
            } else {
              console.error("Send button not found - using programmatic submission");
              
              const parentForm = promptTextarea.closest('form');
              if (parentForm) {
                parentForm.submit();
              } else {
                console.error("No form found either, using keyboard event as last resort");
                const keyEvent = new KeyboardEvent('keydown', {
                  key: 'Enter',
                  code: 'Enter',
                  which: 13, 
                  keyCode: 13,
                  bubbles: true,
                  cancelable: false  // Make it non-cancelable
                });
                
                const origListener = promptTextarea.onkeydown;
                promptTextarea.onkeydown = null;
                
                promptTextarea.dispatchEvent(keyEvent);
                
                // Restore listener
                setTimeout(() => {
                  promptTextarea.onkeydown = origListener;
                }, 100);
              }
            }
          }
        })();
      }
    });
    observer.disconnect();
  }
}

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
    if (typeof body === 'string') {
      try {
        const parsedBody = JSON.parse(body);
        if (parsedBody && typeof parsedBody.prompt === 'string') {
          const { encryptedPrompt, originalData } = await processPrompt(parsedBody.prompt);
          if (Object.keys(originalData).length > 0) {
            parsedBody.prompt = encryptedPrompt;
            options.body = JSON.stringify(parsedBody);
            console.log("Modified fetch request to /conversation:", options.body);
          }
        } else if (parsedBody && Array.isArray(parsedBody.messages)) {
          for (const message of parsedBody.messages) {
            if (message && typeof message.content === 'string') {
              const { encryptedPrompt, originalData } = await processPrompt(message.content);
              if (Object.keys(originalData).length > 0) {
                message.content = encryptedPrompt;
                options.body = JSON.stringify(parsedBody);
                console.log("Modified fetch request to /conversation (messages):", options.body);
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



// console.log("AI Prompt Privacy Protector content script loaded.");

// let promptListenerSetupComplete = false;

// async function processPrompt(prompt) {
//     console.log("Processing prompt:", prompt);
//     console.log("Input to processPrompt:", prompt); // Verify input
//     const sensitiveData = {};
//     const patterns = {
//         email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
//         phone: /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
//     };
//     let processedPrompt = prompt;
//     for (const key in patterns) {
//         const matches = processedPrompt.matchAll(patterns[key]);
//         for (const match of matches) {
//             const original = match[0];
//             const encrypted = await encryptData(original);
//             sensitiveData[original] = encrypted;
//             processedPrompt = processedPrompt.replace(original, `[ENCRYPTED:${key}]`);
//         }
//     }
//     console.log("Sanitized prompt:", processedPrompt, " | Found data:", sensitiveData);
//     return { encryptedPrompt: processedPrompt, originalData: sensitiveData };
// }


// async function encryptData(data) {
//   console.log("Encrypting data:", data);
//   try {
//     const keyMaterial = await window.crypto.subtle.generateKey(
//       { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
//     );
//     console.log("Key generated successfully.");
//     const iv = window.crypto.getRandomValues(new Uint8Array(12));
//     console.log("IV generated:", iv);
//     const encodedData = new TextEncoder().encode(data);
//     console.log("Encoded data:", encodedData);
//     const ciphertext = await window.crypto.subtle.encrypt(
//       { name: "AES-GCM", iv: iv }, keyMaterial, encodedData
//     );
//     console.log("Encryption successful:", ciphertext);
//     const ivArray = Array.from(iv);
//     const ciphertextArray = Array.from(new Uint8Array(ciphertext));
//     const combined = ivArray.concat(ciphertextArray);
//     const base64Result = btoa(String.fromCharCode.apply(null, combined));
//     console.log("Base64 encrypted data:", base64Result);
//     return base64Result;
//   } catch (error) {
//     console.error("Encryption error:", error);
//     return null;
//   }
// }

// function setupPromptListener() {
//   const textarea = document.querySelector('textarea');
//   if (textarea && !promptListenerSetupComplete) {
//       console.log("Prompt textarea found, adding keydown listener.");
//       textarea.addEventListener('keydown', async (event) => {
//           if (event.key === 'Enter' && !event.shiftKey) {
//               const input = textarea.value.trim();
//               console.log("Enter pressed. Original input:", input);
//               const { encryptedPrompt, originalData } = await processPrompt(input);

//               if (Object.keys(originalData).length > 0) {
//                   event.preventDefault();
//                   textarea.value = encryptedPrompt;
//                   console.log("Replaced input value with sanitized prompt:", encryptedPrompt);

//                   const submitButton = textarea.closest('form')?.querySelector('button[type="submit"], button');
//                   if (submitButton) {
//                       console.log("Submit button found, clicking it.");
//                       submitButton.click();
//                   } else {
//                       console.warn("Couldn't find submit button.");
//                   }
//               }
//           }
//       });
//       promptListenerSetupComplete = true;
//       observer.disconnect(); // Disconnect after setting up once
//   } else if (textarea && promptListenerSetupComplete) {
//       console.log("Prompt listener already set up.");
//       observer.disconnect();
//   }
// }

// const observer = new MutationObserver(setupPromptListener);
// // Try to observe a more specific container - adjust the selector if needed
// const composerContainer = document.querySelector('.absolute.right-3.bottom-0');
// if (composerContainer) {
//   observer.observe(composerContainer, { childList: true, subtree: true });
//   console.log("Started MutationObserver on composer container.");
// } else {
//   observer.observe(document.body, { childList: true, subtree: true });
//   console.log("Started MutationObserver on body (composer container not found).");
// }

// // Start observing the document body
// observer.observe(document.body, { childList: true, subtree: true });

// // --- Intercepting fetch for the conversation API (remains the same) ---
// const originalFetch = window.fetch;
// window.fetch = async (...args) => {
//   const url = args[0];
//   const options = args[1] || {};
//   let body = options.body;

//   if (url.includes("chatgpt.com/backend-api/conversation")) {
//     if (typeof body === 'string') {
//       try {
//         const parsedBody = JSON.parse(body);
//         if (parsedBody && typeof parsedBody.prompt === 'string') {
//           const { encryptedPrompt, originalData } = await processPrompt(parsedBody.prompt);
//           if (Object.keys(originalData).length > 0) {
//             parsedBody.prompt = encryptedPrompt;
//             options.body = JSON.stringify(parsedBody);
//             console.log("Modified fetch request to /conversation:", options.body);
//           }
//         } else if (parsedBody && Array.isArray(parsedBody.messages)) {
//           for (const message of parsedBody.messages) {
//             if (message && typeof message.content === 'string') {
//               const { encryptedPrompt, originalData } = await processPrompt(message.content);
//               if (Object.keys(originalData).length > 0) {
//                 message.content = encryptedPrompt;
//                 options.body = JSON.stringify(parsedBody);
//                 console.log("Modified fetch request to /conversation (messages):", options.body);
//                 break;
//               }
//             }
//           }
//         }
//       } catch (e) {
//         console.error("Error parsing or processing fetch body:", e);
//       }
//     }
//   }

//   return originalFetch.apply(this, args);
// };