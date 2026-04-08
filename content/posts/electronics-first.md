---
title: "STM32 PWM 调光实验"
date: "2026-04-05"
category: "electronics"
excerpt: "用定时器输出 PWM 控制 LED 亮度，并记录关键参数。"
tags: ["电子", "STM32", "PWM"]
---

这篇文章记录 PWM 调光的基础实验。

核心代码：

```c
void pwm_set(uint16_t duty) {
  __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, duty);
}
```

占空比计算公式：

$$
D = \frac{T_{on}}{T} \times 100\%
$$

后续准备加入 ADC 反馈，实现闭环亮度控制。
