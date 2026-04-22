---
title: "Reversi Bot"
date: "2026-04-18"
category: "electronics"
excerpt: "A reversi bot that I've built is now deplyed on site!"
tags: ["Reversi", "AI bot"]
---

![alt text](/images/asset.HEIC)
In our course APS105, there is a "bot competition" that everyone builds a reversi bot and played against other's bot. My reversi bot ranked 9th out of 440 students on the leader board. If you are interested, the same algorithm is playable on site!

**Algorithm**: It uses a Minimax algorithm with Alpha-Beta pruning to look several turns ahead and discard bad options. To allow more search in given time limit, it uses iterative deepening, meaning it digs as deep into the game tree as possible within a strict 0.93-second time limit.

**Stratergy**: It prioritizes controlling the corners and keeping its move options open (mobility) rather than just grabbing the most pieces early on. It also shifts its logic as the game progresses.
