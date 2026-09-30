import os
import math
import time
import numpy as np
import torch
import torch.nn as nn
from torch.distributions import Normal
import gymnasium as gym

# ===========================================================================
# 1. ACTOR NETWORK ARCHITECTURE
# ===========================================================================
class ACTOR(nn.Module):
    def __init__(self, STATE_DIM=4, ACTION_DIM=1, MAX_ACTION=10.0):
        super(ACTOR, self).__init__()
        self.MAX_ACTION = MAX_ACTION

        self.NET = nn.Sequential(
            nn.Linear(STATE_DIM, 64),
            nn.Tanh(),
            nn.Linear(64, 64),
            nn.Tanh(),
            nn.Linear(64, ACTION_DIM),
        )

        self.ACTOR_LOG_STD = nn.Parameter(torch.full((1, ACTION_DIM), -0.5))

    def FORWARD(self, STATE):
        MEAN = self.NET(STATE)
        LOG_STD = torch.clamp(self.ACTOR_LOG_STD, min=-3.0, max=0.0)
        STD = torch.exp(LOG_STD.expand_as(MEAN))
        return MEAN, STD

    def GET_ACTION(self, STATE, DETERMINISTIC=False):
        MEAN, STD = self.FORWARD(STATE)
        if DETERMINISTIC:
            ACTION = torch.tanh(MEAN) * self.MAX_ACTION
            return ACTION, torch.zeros_like(MEAN), MEAN

        DIST = Normal(MEAN, STD)
        U = DIST.sample()
        ACTION = torch.tanh(U) * self.MAX_ACTION

        LOG_PROB = DIST.log_prob(U) - torch.log(1.0 - torch.tanh(U) ** 2 + 1e-6)
        LOG_PROB = LOG_PROB.sum(dim=-1, keepdim=True)

        return ACTION, LOG_PROB, U

    forward = FORWARD

# ===========================================================================
# 2. PPO AGENT (EVALUATION ONLY)
# ===========================================================================
class PPOAGENT:
    def __init__(self, STATE_DIM=4, ACTION_DIM=1, DEVICE="cpu"):
        self.DEVICE = torch.device(DEVICE)
        self.ACTOR = ACTOR(STATE_DIM, ACTION_DIM).to(self.DEVICE)

# ===========================================================================
# 3. MAIN EXECUTION
# ===========================================================================
def MAIN():
    WEIGHTS_PATH = "/Users/apple/Desktop/POLE/ppo_actor.pt"

    if not os.path.exists(WEIGHTS_PATH):
        print(f"Error: Weights file not found at '{WEIGHTS_PATH}'")
        return

    ENV_GYM = gym.make("CartPole-v1", render_mode="human")
    DEVICE = "cpu"
    EVAL_AGENT = PPOAGENT(STATE_DIM=4, ACTION_DIM=1, DEVICE=DEVICE)
    EVAL_AGENT.ACTOR.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
    EVAL_AGENT.ACTOR.eval()

    print(f"Successfully loaded weights from: {WEIGHTS_PATH}")
    
    STATE, _ = ENV_GYM.reset()
    
    # 1. ACTIVE CONTROL PHASE (NETWORK DRIVES THE MOTOR FOR 500 STEPS)
    print("Motor ON: Policy actively stabilizing the pendulum...")
    for STEP in range(500):
        STATE_TENSOR = torch.as_tensor(STATE, dtype=torch.float32, device=EVAL_AGENT.DEVICE).unsqueeze(0)

        with torch.no_grad():
            CONTINUOUS_ACTION, _, _ = EVAL_AGENT.ACTOR.GET_ACTION(
                STATE_TENSOR, DETERMINISTIC=True
            )
            FORCE = CONTINUOUS_ACTION.item()

        DISCRETE_ACTION = 1 if FORCE >= 0.0 else 0
        STATE, REWARD, TERMINATED, TRUNCATED, INFO = ENV_GYM.step(DISCRETE_ACTION)

        time.sleep(0.02)

        if TERMINATED or TRUNCATED:
            print(f"Active control terminated early at step {STEP + 1}.")
            break

    # 2. MOTOR TURNED OFF PHASE (LET GRAVITY TAKE OVER UNTIL THE POLE FALLS)
    print("\nMotor OFF: Disabling active control. Watching the pole fall under gravity...")
    DONE = False
    FREE_FALL_STEPS = 0

    while not DONE and FREE_FALL_STEPS < 200:
        # Pass a neutral action (e.g., 0) while ignoring network outputs
        STATE, REWARD, TERMINATED, TRUNCATED, INFO = ENV_GYM.step(0)
        FREE_FALL_STEPS += 1
        DONE = TERMINATED or TRUNCATED
        time.sleep(0.02)

    print(f"Pole completely fell over after {FREE_FALL_STEPS} unpowered steps.")

    input("\nPress ENTER in Terminal to close the window...")
    ENV_GYM.close()


if __name__ == "__main__":
    MAIN()
