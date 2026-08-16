const response = await fetch("http://localhost:3000/deadlines/follow-up", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ responseDeadline: "2030-06-12", asOf: "2030-06-10T09:00:00.000Z" })
});

console.log(await response.json());
