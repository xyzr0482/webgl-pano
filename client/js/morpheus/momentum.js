import { last } from 'lodash';
import {
  rotateBy,
} from '../actions/pano';
import store from '../store';
import {
  addMouseUp,
  addMouseMove,
  addMouseDown,
} from '../actions/ui';

export default function (dispatch) {
  // Here an interaction is a user touch gesture or a pointer movement with mouse clicked
  const interaction = {
    // If we are in a user interaction
    active: false,
    // The timestamp of the start of the last user interaction with scene
    startTime: -1,
    // All positions for this interaction event
    positions: [],
    // The start of an interaction position
    startPos: {},
  };

  // Momentum is a sense of continued be deaccelerating user interaction that continues after the user event ends
  const momentum = {
    intervalId: 0,
    speed: { x: 0, y: 0}
  };

  const SWING_DELTA = 0.25;
  const DEG_TO_RAD = Math.PI / 180;
  const MAX_MOMENTUM = 0.5 * DEG_TO_RAD;

  function convertFromHorizontalSpeed(delta, sensitivity) {
    const speed =  (delta * DEG_TO_RAD) / (10.0 * ((19 - sensitivity) / 18.0 ));
    return speed;
  }

  function convertFromVerticalSpeed(delta, sensitivity) {
    return (delta * DEG_TO_RAD) / (7.0 * ((19 - sensitivity) / 18.0 ));
  }


  function updateMomentum() {
    const { pano } = store.getState();
    const {
      sensitivity,
      rotation,
    } = pano;
    let yFine = false;

    if (momentum.speed.y > MAX_MOMENTUM) {
      momentum.speed.y -= MAX_MOMENTUM;
    } else if (momentum.speed.y < -MAX_MOMENTUM) {
      momentum.speed.y += MAX_MOMENTUM;
    } else {
      momentum.speed.y = 0;
      yFine = true;
    }

    if (momentum.speed.x > MAX_MOMENTUM ) {
      momentum.speed.x -= MAX_MOMENTUM;
    } else if (momentum.speed.x < -MAX_MOMENTUM) {
      momentum.speed.x += MAX_MOMENTUM;
    } else if (yFine){
      momentum.speed.x = 0;
      clearInterval(momentum.intervalId);
    }

    dispatch(rotateBy(momentum.speed));
  }

  function onMouseDown(mouseEvent) {
    const { clientX: left, clientY: top } = mouseEvent;
    interaction.startTime = Date.now();
    interaction.active = true;
    interaction.positions = [{ top, left, time: interaction.startTime }];
    interaction.startPos = interaction.positions[0];
    clearInterval(interaction.intervalId);
  }

  function onMouseMove(mouseEvent) {
    if (interaction.active) {
      const { clientX: left, clientY: top } = mouseEvent;
      const { pano } = store.getState();
      const {
        controlType,
        sensitivity,
      } = pano;
      const interactionLastPos = last(interaction.positions);
      const speed = {
        horizontal: left - interactionLastPos.left,
        vertical: top - interactionLastPos.top,
      };
      const delta = {
        horizontal: convertFromHorizontalSpeed(speed.horizontal, sensitivity),
        vertical: convertFromVerticalSpeed(speed.vertical, sensitivity),
      };
      interaction.positions.push({ top, left, time: Date.now() });
      if (interaction.positions.length > 5) {
        interaction.positions.shift();
      }

      dispatch(rotateBy({
        x: delta.vertical,
        y: delta.horizontal,
      }));
    }
  }

  function onMouseUp(mouseEvent) {
    const { clientX: left, clientY: top } = mouseEvent;
    const {
      interactionDebounce,
      sensitivity,
    } = store.getState().pano;
    let interactionMomemtum = { x: 0, y: 0 };
    const interactionDistance = Math.sqrt(
      Math.pow(interaction.startPos.left - left, 2)
       + Math.pow(interaction.startPos.top - top, 2)
    );
    if (interactionDistance > interactionDebounce) {
      const averageSpeed = interaction.positions.reduce((memo, speed, index) => {
        if (index === 0) {
          return memo;
        }
        const previous = interaction.positions[index - 1];
        const deltaTime = speed.time - previous.time;
        const deltaX = speed.left - previous.left;
        const deltaY = speed.top - previous.top;
        const speedX = deltaX / deltaTime;
        const speedY = deltaY / deltaTime;
        return {
          left: (memo.left + speedX) / 2,
          top: (memo.top + speedY) / 2,
        };
      }, {
        top: 0,
        left: 0,
      });

      averageSpeed.left *= 50;
      averageSpeed.top *= 10;
      momentum.speed = {
        x: convertFromHorizontalSpeed(averageSpeed.top, sensitivity),
        y: convertFromVerticalSpeed(averageSpeed.left, sensitivity),
      };
      console.log('momentum speed', momentum.speed);
      clearInterval(momentum.intervalId);
      momentum.intervalId = setInterval(updateMomentum, 50);
    }
    interaction.active = false;
  }

  dispatch(addMouseUp(onMouseUp));
  dispatch(addMouseMove(onMouseMove));
  dispatch(addMouseDown(onMouseDown));
}
