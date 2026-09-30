import os # new1
import math
import time
import numpy as np
import torch
import torch.nn as nn
from torch.distributions import Normal
import gymnasium as gym

# ===========================================================================
# 1. CUSTOM CONTINUOUS ENVIRONMENT
# ===========================================================================
class ENVIRONMENT:
    def __init__(self, SEED=42):
        self.GRAVITY = 9.81
        self.MASS_CART = 1.0
        self.MASS_POLE = 0.1
        self.TOTAL_MASS = self.MASS_CART + self.MASS_POLE
        self.LENGTH = 0.5
        self.POLEMASS_LENGTH = self.MASS_POLE * self.LENGTH
        self.MAX_FORCE = 10.0
        self.TAU = 0.02

        self.X_THRESHOLD = 2.4
        self.THETA_THRESHOLD_RADIANS = 12 * 2 * math.pi / 360

        self.RNG = np.random.RandomState(SEED)
        self.STATE = None

    def RESET(self):
        self.STATE = self.RNG.uniform(low=-0.05, high=0.05, size=(4,))
        return np.array(self.STATE, dtype=np.float32)

    def STEP(self, ACTION):
        FORCE = np.clip(ACTION[0], -self.MAX_FORCE, self.MAX_FORCE)
        X, X_DOT, THETA, THETA_DOT = self.STATE

        COSTHETA = math.cos(THETA)
        SINTHETA = math.sin(THETA)

        TEMP = (FORCE + self.POLEMASS_LENGTH * THETA_DOT**2 * SINTHETA) / self.TOTAL_MASS
        THETAACC = (self.GRAVITY * SINTHETA - COSTHETA * TEMP) / (
            self.LENGTH * (4.0 / 3.0 - self.MASS_POLE * COSTHETA**2 / self.TOTAL_MASS)
        )
        XACC = TEMP - self.POLEMASS_LENGTH * THETAACC * COSTHETA / self.TOTAL_MASS

        X = X + self.TAU * X_DOT
        X_DOT = X_DOT + self.TAU * XACC
        THETA = THETA + self.TAU * THETA_DOT
        THETA_DOT = THETA_DOT + self.TAU * THETAACC

        self.STATE = np.array([X, X_DOT, THETA, THETA_DOT], dtype=np.float32)

        DONE = bool(
            X < -self.X_THRESHOLD
            or X > self.X_THRESHOLD
            or THETA < -self.THETA_THRESHOLD_RADIANS
            or THETA > self.THETA_THRESHOLD_RADIANS
        )

        return self.STATE, 0.0, DONE


# ===========================================================================
# 2. ACTOR NETWORK ARCHITECTURE
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
# 3. PPO AGENT (EVALUATION ONLY)
# ===========================================================================
class PPOAGENT:
    def __init__(self, STATE_DIM=4, ACTION_DIM=1, DEVICE="cpu"):
        self.DEVICE = torch.device(DEVICE)
        self.ACTOR = ACTOR(STATE_DIM, ACTION_DIM).to(self.DEVICE)


# ===========================================================================
# 4. MAIN EXECUTION
# ===========================================================================
def MAIN():
    WEIGHTS_PATH = "/Users/apple/Desktop/POLE/ppo_actor.pt"

    if not os.path.exists(WEIGHTS_PATH):
        print(f"Error: Weights file not found at '{WEIGHTS_PATH}'")
        return

    # USE GYMNASIUM FOR VISUAL WINDOW ONLY
    RENDER_ENV = gym.make("CartPole-v1", render_mode="human")
    RENDER_ENV.reset()

    # USE CUSTOM ENVIRONMENT FOR ACCURATE CONTINUOUS PHYSICS
    PHYSICS_ENV = ENVIRONMENT(SEED=100)
    STATE = PHYSICS_ENV.RESET()

    DEVICE = "cpu"
    EVAL_AGENT = PPOAGENT(STATE_DIM=4, ACTION_DIM=1, DEVICE=DEVICE)
    EVAL_AGENT.ACTOR.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
    EVAL_AGENT.ACTOR.eval()

    print(f"Successfully loaded weights from: {WEIGHTS_PATH}")

    # -----------------------------------------------------------------------
    # PHASE 1: MOTOR ON (POLICY ACTIVE)
    # -----------------------------------------------------------------------
    print("\nMotor ON: Policy actively stabilizing the pendulum...")
    for STEP in range(300):
        STATE_TENSOR = torch.as_tensor(STATE, dtype=torch.float32, device=EVAL_AGENT.DEVICE).unsqueeze(0)

        with torch.no_grad():
            CONTINUOUS_ACTION, _, _ = EVAL_AGENT.ACTOR.GET_ACTION(
                STATE_TENSOR, DETERMINISTIC=True
            )
            ACTION_NP = CONTINUOUS_ACTION.squeeze(0).cpu().numpy()

        STATE, _, DONE = PHYSICS_ENV.STEP(ACTION_NP)

        # UPDATE VISUAL FRAME WITH EXACT PHYSICS STATE
        RENDER_ENV.unwrapped.state = np.array(STATE, dtype=np.float64)
        RENDER_ENV.render()

        time.sleep(0.02)

        if DONE:
            print(f"Active control terminated early at step {STEP + 1}.")
            break

    # -----------------------------------------------------------------------
    # PHASE 2: MOTOR OFF (ZERO FORCE / PURE GRAVITY)
    # -----------------------------------------------------------------------
    print("\nMotor OFF: Cutting motor power (Force = 0.0 N). Watching pole fall under gravity...")

    # ADD A TINY NUDGE (0.01 RAD / ~0.57 DEG) TO BREAK PERFECT VERTICAL BALANCE IF NEEDED
    PHYSICS_ENV.STATE[2] += 0.01

    FREE_FALL_STEPS = 0
    ZERO_FORCE_ACTION = np.array([0.0], dtype=np.float32)

    for STEP in range(200):
        # APPLY EXACTLY 0.0 FORCE TO SIMULATE UNPOWERED COASTING
        STATE, _, _ = PHYSICS_ENV.STEP(ZERO_FORCE_ACTION)
        FREE_FALL_STEPS += 1

        # UPDATE VISUAL FRAME WITH EXACT PHYSICS STATE
        RENDER_ENV.unwrapped.state = np.array(STATE, dtype=np.float64)
        RENDER_ENV.render()

        time.sleep(0.02)

        # STOP IF POLE FALLS PAST VERTICAL (>= 90 DEGREES)
        THETA = STATE[2]
        if abs(THETA) >= math.pi / 2:
            print(f"Pole completely fell over at step {FREE_FALL_STEPS} | Angle: {math.degrees(THETA):.1f} deg")
            break

    input("\nSimulation finished! Press ENTER in Terminal to close window...")
    RENDER_ENV.close()


if __name__ == "__main__":
    MAIN()
