async function sendMessage() {
  const input = document.getElementById("input");
  const output = document.getElementById("output");

  const userText = input.value;

  if (!userText) return;

  output.innerText = "Thinking...";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: userText }),
    });

    const data = await res.json();

    output.innerText = data.reply;
  } catch (err) {
    console.error(err);
    output.innerText = "Error";
  }
}
