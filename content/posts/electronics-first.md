---
title: "STM32 PWM dimming lab"
date: "2026-04-05"
category: "electronics"
excerpt: "Timer PWM to drive an LED, with the key registers called out."
tags: ["electronics", "STM32", "PWM"]
---

Quick lab notes on PWM dimming.

Core helper:

```c
void pwm_set(uint16_t duty) {
  __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, duty);
}
```

Duty cycle:

$$
D = \frac{T_{on}}{T} \times 100\%
$$

Next: add ADC feedback for closed-loop brightness.
