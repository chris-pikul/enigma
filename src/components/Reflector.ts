/**
 * Enigma
 * =============================================================================
 * Copyright © 2022 Chris Pikul.
 * Licensed under GNU General Public License version 3.
 * See file `LICENSE` at project root for more information
 * =============================================================================
 * 
 * Class representing the Reflector, or Umkehrwalze (UKW). The Reflector is
 * responsible for taking the incoming connection from the last wheel, and then
 * re-routing back into the last wheel under a different character. Most
 * Reflectors are static (non-rotating), but some can rotate, as well as allow
 * custom re-wiring.
 */
import type IEncodable from '../interfaces/IEncodable';
import type IRotatable from '../interfaces/IRotatable';
import type { IValidatable, OptErrors } from '../interfaces/IValidatable';

import { circular, findDuplicates } from '../common';

/**
 * Reflector, or Umkehrwalze (UKW).
 * 
 * The Reflector is
 * responsible for taking the incoming connection from the last wheel, and then
 * re-routing back into the last wheel under a different character. Most
 * Reflectors are static (non-rotating), but some can rotate, as well as allow
 * custom re-wiring (UKW-D).
 */
export class Reflector implements IEncodable, IRotatable, IValidatable {
  /**
   * The displayed label or name for this wheel
   */
  readonly label:string;

  /**
   * The maximum number of characters. For the standard latin alphabet rings
   * this value should be 26. The Funkschlüssel C has 28, and the Model Z has
   * 10.
   */
  readonly numCharacters:number;

  /**
   * Internal wiring of the Reflector.
   * 
   * This value is an array of numbers, each number is considered the 0-based
   * offset for the substitution character. Each value in this array must be
   * unique, and the length of the array must match the numCharacters property.
   * 
   * For instance, `wiring[0] = 5` means that on the input character 0 (A), the
   * resulting output will be 5 (E).
   * 
   * Marked as `readonly` because this value should not change in between
   * wheels.
   */
  readonly wiring:Array<number>;

  /**
   * The starting position (Grundstellung) for this Wheel.
   * 
   * This value is a number being the 0-based index of the starting position.
   * The number maps to the character at that index. IE. 0 = A, 5 = E.
   * 
   * Not all models feature a movable Reflector so this behavior is determined
   * by the model being emulated.
   */
  #startingPosition:number;
 
  /**
   * Determines if this Reflector is movable, as in, it rotates on key-presses.
   * 
   * From my research this appears to only be on the Model G versions.
   */
  readonly moving:boolean;

  /**
   * The current position that the Reflector is in.
   * 
   * This is a 0-based index of the Reflector's current physical position.
   * 
   * Not all models feature movable Reflector's. Either in setting the starting
   * position, or rotating during usage. This moving functionality is determined
   * by the `moving` property on this Reflector. Some Reflectors can be
   * installed in a set position, and may not move during use.
   * 
   * @private
   */
  #position:number;

  /**
   * If true, the Reflector has called the setup function
   */
  #init:boolean;

  constructor(label:string, numChars:number, wiring:Array<number>, moving = false) {
    // Bind methods

    // Setup readonly variables

    if(label.length < 1)
      throw new TypeError(`Reflector constructed with parameter 1 "label" being empty.`);
    this.label = label;

    if(numChars <= 0)
      throw new TypeError(`Reflector constructed with parameter 2 "numChars" being 0 or under.`);
    this.numCharacters = numChars;

    if(!Array.isArray(wiring) || wiring.length !== numChars)
      throw new TypeError(`Reflector constructed with parameter 3 "wiring" being invalid. Please use an array with the same length as the second "numChars" parameter.`);
    this.wiring = [ ...wiring ];

    this.moving = !!moving;

    // Remaining defaults
    this.#startingPosition = 0;
    this.#position = 0;
    this.#init = false;
  }

  /**
   * The initial starting position (Grundstellung) the Reflector was in when
   * setup.
   * 
   * @readonly
   */
  get startingPosition():number {
    return this.#startingPosition;
  }

  /**
   * Current position the Reflector is in
   */
  get position():number {
    return this.#position;
  }

  /**
   * True, if the {@link Reflector.setup()} method has been called
   */
  get isSetup():boolean {
    return this.#init;
  }

  /**
   * Performs initial setup of the wheel.
   * 
   * For most Reflector models, this function does not need to be called as
   * they are unmoving (static) parts.
   * 
   * @param startPosition 0-based offset position for the Reflector
   */
  public setup(startPosition = 0):void {
    this.#startingPosition = circular(startPosition, this.numCharacters);
    this.#position = this.#startingPosition;
    this.#init = true;
  }

  /**
   * Performs the encoding of the input character, designated as an index, and
   * returning the new character index.
   * 
   * The input index is modified by the position the Reflector is currently in,
   * if applicable to the model.
   * 
   * @param index Input character index (0-based)
   * @returns New character index (0-based)
   */
  public encode(index:number):number {
    const char = circular(index + this.#position, this.numCharacters);
    return this.wiring[char];
  }

  /**
   * Advances, or rotates, the Reflector a number of steps forward.
   * 
   * For most Reflector models they are static and unmoving. Since some can
   * move, the switch on construction `moving` declares if this function
   * actual performs any work. In the case that {@link Reflector.moving} is
   * false (default), calling `advance()` will just return back as a no-op.
   * 
   * @param steps Number of steps or positions to rotate (Default 1)
   */
  public advance(steps = 1): void {
    // Shortcut out if this reflector does not move
    if(this.moving === false)
      return;

    this.#position = circular(this.#position + steps, this.numCharacters);
  }

  /**
   * Validates that the settings for the Reflector are correct.
   * 
   * This basically just ensures that there is no duplicate values in the wiring
   * array.
   * 
   * @returns Undefined if no errors, or an array of error objects
   */
  public validate():OptErrors {
    const dups:Array<[number, number]> = findDuplicates<number>(this.wiring);

    if(dups.length)
      return dups.map(([ ind, val ]) => new Error(`Reflector.wiring[${ind}] is a duplicate value '${val}'`));
  }
}
export default Reflector;
