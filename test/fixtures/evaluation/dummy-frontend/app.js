function mountApp(rootElement) {
  const btn = document.createElement("button");
  btn.textContent = "Click Me";
  
  let count = 0;
  btn.addEventListener("click", () => {
    count++;
    btn.textContent = `Clicked ${count} times`;
  });
  
  rootElement.appendChild(btn);
}

export { mountApp };
