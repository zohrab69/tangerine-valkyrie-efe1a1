# Error alerts and health check (Alerts v2)
Team: JARVIS (CEO) · Runs: when any workflow fails; every day 9:07 and 10:40

- Any failing JARVIS workflow sends an alert (same problem: once per hour).
- Daily: checks the free AI, the voice service, the SerpApi and Shopify keys (alarm when a key that worked stops working, or few free searches left) and that the 10:00 research went out.
- Silent when everything is fine. Outside the server, UptimeRobot watches that the server itself is up.
