/**
 * Enigma
 * =============================================================================
 * Copyright © 2022 Chris Pikul.
 * Licensed under GNU General Public License version 3.
 * See file `LICENSE` at project root for more information
 * =============================================================================
 * 
 * Primary "Machine" class for the Engima. Holds the settings and components
 * required for operating the Enigma simulation. This class should be the
 * primary interaction for any Enigma simulations
 */

import { getCharacterFromIndex, getCharacterIndex } from '../alphabet';
import { forEachReverse } from '../common';
import { Trace, TraceStep } from '../interfaces/debugging';
import type IValidatable from '../interfaces/IValidatable';

import Plugboard from './Plugboard';
import Reflector from './Reflector';
import Stator from './Stator';
import Wheel from './Wheel';

/**
 * The Machine represents the physical collection of all the components and
 * settings into a singular model used for encoding messages. This Class is
 * intended to be the main representation of any Enigma model as it actually
 * performs the functionality needed to do the encoding.
 */
export class Machine implements IValidatable {
  /**
   * Displayable string identifying the model of this Machine.
   */
  readonly label:string;

  /**
   * The alphabet that is accepted by this Machine.
   * 
   * This is a string containing each character once. From this alphabet, the
   * number of characters {@link Machine.numCharacters} is derived.
   */
  readonly alphabet:string;

  /**
   * The number of characters present on this Machine. This is considered the
   * number of alphabet characters encodable.
   */
  readonly numCharacters:number;

  /**
   * The Plugboard component, if present on this model.
   */
  plugboard:(null | Plugboard) = null;

  /**
   * The entry wheel, or Entrittswalze (ETW) which performs the first step of
   * character mapping/encoding before the wheels get to act. Additionally it
   * is used to map back after the wheels encoding for processing back through
   * to output.
   */
  entryWheel:Stator;

  /**
   * The configuration of wheels, or rotors, used for encoding between the
   * entry wheel (ETW), and the reflector (UKW).
   * 
   * This is represented as an Array of Wheel objects. The indices are
   * considered right-to-left in relation to a physical machine. That is,
   * physically Enigma machines had the entry wheel on the right, and the
   * Reflector (UKW) on the left. So that the first wheel to perform encoding
   * is the rightmost, or considered the first wheel. In this array, the first
   * index (0) is the right-most wheel; being first and last to encode.
   */
  wheels:Array<Wheel> = [];

  /**
   * The reflector, or Umkehrwalze (UKW), that's used in the wheel/rotor
   * assembly.
   */
  reflector:(null | Reflector) = null;

  /**
   * Creates a new Machine
   * @param label Displayable string to identify this Machine
   * @param numChars Number of characters supported
   * @param etw Entry-wheel Stator object
   * @param wheels Array of rotor Wheel objects. See {@link Machine.wheels}}.
   * @param ukw Reflector object
   * @param plugboard Optional Plugboard object
   */
  constructor(label:string, alphabet:string, etw:Stator, wheels?:Array<Wheel>, ukw?:Reflector, plugboard?:Plugboard) {
    // Bind Methods
    this.processCharacter = this.processCharacter.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this.validate = this.validate.bind(this);

    // Apply properties and check for loose validity
    if(label.length <= 0)
      throw new TypeError(`Machine constructed with an empty 'label' parameter [0].`);
    this.label = label;

    if(alphabet.length === 0)
      throw new TypeError(`Machine constructed with an invalid 'alphabet' parameter [1].`);
    this.alphabet = alphabet.toUpperCase();
    this.numCharacters = this.alphabet.length;

    if((etw instanceof Stator) === false)
      throw new TypeError(`Machine constructed with an invalid 'etw' parameter [2].`);
    this.entryWheel = etw;

    this.wheels = [ ...(wheels ?? []) ];

    if(ukw) {
      if((ukw instanceof Reflector) === false)
        throw new TypeError(`Machine constructed with an invalid 'ukw' parameter [4]`);
    
      this.reflector = ukw;
    }

    if(plugboard) {
      if((plugboard instanceof Plugboard) === false)
        throw new TypeError(`Machine constructed with an invalid 'plugboard' parameter [5]`);
      this.plugboard = plugboard;
    }
  }

  /**
   * Resets the state of this machine back to the starting settings
   */
  public reset():void {
    this.wheels.forEach(whl => whl.reset());
    this.reflector?.reset();
  }

  /**
   * Performs encoding of a single string character into an output character.
   * 
   * This will perform any mechanical operations such as advancing of wheels
   * during the encoding process. This advancement process happens before the
   * character is encoded by the wheels.
   * 
   * The general order of encoding process is as follows:
   * 
   * ```
   * Keyboard -> Plugboard? -> Stator -> Wheel[0]..Wheel[N] ->
   * Reflector -> Wheel[N]..Wheel[0] -> Stator -> Plugboard? ->
   * Output
   * ```
   * 
   * @param char Input character to encode
   * @param unknownAs Fallback for any unknown characters
   * @returns New character
   */
  public processCharacter(char:string, unknownAs = 'X'):[string, Trace] {
    // Ensure we have any required parts
    if(!this.reflector)
      throw new Error(`Machine "${this.label}" does not have a reflector installed.`);

    const trace:Trace = {
      inputRaw: char,
      steps: [],
    };
    
    // Normalize the character
    const input = char[0].toUpperCase();
    trace.inputChar = input;

    // Ensure the input is a single character
    if(input.length === 0 || input.length > 1)
      throw new Error(`Machine.encode() recieved a character that was either empty, or longer than 1 character.`);

    // Start by converting the character to the keyboard alphabet index
    let index = getCharacterIndex(input, this.alphabet, unknownAs);
    trace.inputIndex = index;

    // Use the plugboard if it's installed
    if(this.plugboard) {
      const trc:TraceStep = {
        op: 'Encode',
        component: 'Plugboard',
        input: index,
        inputChar: getCharacterFromIndex(index, this.alphabet, unknownAs),
      };

      index = this.plugboard.encode(index);

      trc.output = index;
      trc.outputChar = getCharacterFromIndex(index, this.alphabet, unknownAs);
      trace.steps.push(trc);
    }

    // Use the Stator (ETW)
    const statorTrcFirst:TraceStep = {
      op: 'Encode',
      component: 'Stator',
      input: index,
      inputChar: getCharacterFromIndex(index, this.alphabet, unknownAs),
    };

    index = this.entryWheel.encode(index);

    statorTrcFirst.output = index;
    statorTrcFirst.outputChar = getCharacterFromIndex(index, this.alphabet, unknownAs);
    trace.steps.push(statorTrcFirst);

    /*
     * Advance the wheels. The right-most [0] wheel always advances, the rest
     * only advance if the wheel to their right (lower in the index) is at the
     * notch position. In other words wheel[i>0] rotates if wheel[i-1] is at
     * their notch position. 
     * 
     * The notch consideration
     * is done regardless of any wheel movements that have happened in this
     * loop already.
     * 
     * After advancement, perform the encoding on the character
     */
    this.wheels.forEach((whl:Wheel, ind:number) => {
      const trcAdv:TraceStep = { op: 'Wheel Advance' };

      if(ind === 0) {
        whl.advance();
        trcAdv.msg = `First wheel "${whl.label}" now showing "${whl.visibleCharacter}"`;
      } else if(this.wheels[ind - 1].atNotch) {
        whl.advance();
        trcAdv.msg = `Wheel ${ind} "${whl.label}" because of notch on ${ind - 1} "${this.wheels[ind - 1].label}", now showing "${whl.visibleCharacter}"`;
      } else {
        trcAdv.msg = `Wheel ${ind} "${whl.label} did not advance, showing "${whl.visibleCharacter}"`;
      }
      trace.steps.push(trcAdv);

      const trc:TraceStep = {
        op: 'Encode',
        component: `Wheel ${ind}`,
        input: index,
        inputChar: getCharacterFromIndex(index, this.alphabet, unknownAs),
      };

      index = whl.encode(index);

      trc.output = index;
      trc.outputChar = getCharacterFromIndex(index, this.alphabet, unknownAs);

      trace.steps.push(trc);
    });

    // If the reflector is capable of moving, do so first
    if(this.reflector.moving) {
      trace.steps.push({
        op: 'Reflector Advance',
        msg: `Advancing reflector "${this.reflector.label}`,
      });

      this.reflector.advance();
    }

    // Use the reflector next before passing back through the wheels in reverse.
    const reflTrc:TraceStep = {
      op: 'Encode',
      component: 'Reflector',
      input: index,
      inputChar: getCharacterFromIndex(index, this.alphabet, unknownAs),
    };

    index = this.reflector.encode(index);

    reflTrc.output = index;
    reflTrc.outputChar = getCharacterFromIndex(index, this.alphabet, unknownAs);
    trace.steps.push(reflTrc);

    // Go through the wheels, in reverse
    forEachReverse<Wheel>(this.wheels, (whl:Wheel, ind:number) => {
      const trc:TraceStep = {
        op: 'Encode Reverse',
        component: `Wheel ${ind}`,
        input: index,
        inputChar: getCharacterFromIndex(index, this.alphabet, unknownAs),
      };
      
      index = whl.encode(index);

      trc.output = index;
      trc.outputChar = getCharacterFromIndex(index, this.alphabet, unknownAs);
      trace.steps.push(trc);
    });

    // Back out through the stator
    const statorTrcLast:TraceStep = {
      op: 'Encode Reverse',
      component: 'Stator',
      input: index,
      inputChar: getCharacterFromIndex(index, this.alphabet, unknownAs),
    };

    index = this.entryWheel.encode(index);

    statorTrcLast.output = index;
    statorTrcLast.outputChar = getCharacterFromIndex(index, this.alphabet, unknownAs);
    trace.steps.push(statorTrcLast);

    // If the plugboard is present, then use it
    if(this.plugboard) {
      const trc:TraceStep = {
        op: 'Encode Reverse',
        component: 'Plugboard',
        input: index,
        inputChar: getCharacterFromIndex(index, this.alphabet, unknownAs),
      };

      index = this.plugboard.encode(index);

      trc.output = index;
      trc.outputChar = getCharacterFromIndex(index, this.alphabet, unknownAs);
      trace.steps.push(trc);
    }

    trace.outputIndex = index;
    trace.outputChar = getCharacterFromIndex(index, this.alphabet, unknownAs);

    // Final output is ready, convert back to the alphabet
    return [ getCharacterFromIndex(index, this.alphabet, unknownAs), trace ];
  }

  /**
   * Processes an entire string message and returns the results.
   * 
   * Encoding/Decoding on Enigma machines works the same for both so there is
   * no need to distinguish between the two.
   * 
   * Ie:
   * ```
   * Plain-text => processMessage() => Cipher-text
   * Cipher-text => processMessage() => Plain-text
   * ```
   * 
   * Note: This does not perform message formatting and will convert 1-to-1.
   * 
   * @param msg String message to encode
   * @param unknownAs Fallback for any unknown characters
   * @returns New string of encoded characters
   */
  public processMessage(msg:string, unknownAs = 'X'):[string, Array<Trace>] {
    if(msg.length === 0)
      return [ msg, [] ];

    const traces:Array<Trace> = [];

    const results = msg.split('')
      .map(char => {
        const [ out, trace ] = this.processCharacter(char, unknownAs);
        traces.push(trace);
        return out;
      })
      .join('');

    return [ results, traces ];
  }

  /**
   * Validates that the settings and components of this Machine are correct.
   * 
   * @returns Array of Error objects (if empty, there where none)
   */
  public validate():Array<Error> {
    const errs:Array<Error> = [];

    // Check that the entry wheel is correct
    if(this.entryWheel.numCharacters !== this.numCharacters)
      errs.push(new Error(`Machine "${this.label}" has an invalid entry wheel (ETW), the number of characters does not match.`));
    errs.push(...this.entryWheel.validate());

    // Check the wheels
    errs.push(...this.wheels.map((whl:Wheel, ind:number) => {
      const subErrs:Array<Error> = [];
      if(whl.numCharacters !== this.numCharacters)
        subErrs.push(new Error(`Machine "${this.label}" has an invalid wheel[${ind}], the number of characters does not match.`));
      
      const valErrs = whl.validate()
        .map(err => new Error(`Machine "${this.label}" has an invalid wheel[${ind}]: ${err.message}.`));

      return [ ...subErrs, ...valErrs ];
    }).flat());

    // Check the reflector
    if(this.reflector) {
      if(this.reflector.numCharacters !== this.numCharacters)
        errs.push(new Error(`Machine "${this.label}" has an invalid reflector (UKW), the number of characters does not match.`));
      errs.push(...this.reflector.validate());
    } else {
      errs.push(new Error(`Machine "${this.label}" does not have a Reflector installed.`));
    }

    // Check the plugboard if we have one
    if(this.plugboard) {
      if(this.plugboard.numCharacters !== this.numCharacters)
        errs.push(new Error(`Machine "${this.label}" has an invalid plugboard configuration, the number of characters does not match.`));
      errs.push(...this.plugboard.validate());
    }

    return errs;
  }
}
export default Machine;
