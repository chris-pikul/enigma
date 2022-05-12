/**
 * Enigma
 * =============================================================================
 * Copyright © 2022 Chris Pikul.
 * Licensed under GNU General Public License version 3.
 * See file `LICENSE` at project root for more information
 * =============================================================================
 * 
 * Class representing the Stator, or Entrittswalze (ETW). The Stator is
 * responsible for mapping the incoming key presses for initial substitution
 * if desired, and then handing the connection over to the rotor arrangment.
 */

import type IEncodable from '../interfaces/IEncodable';
import type { IValidatable, OptErrors } from '../interfaces/IValidatable';

import { circular, findDuplicates } from '../common';

/**
 * Represents the Stator, Entrittswalze (ETW), or entry wheel, of an Enigma 
 * machine.
 * 
 * The Stator does not move during operation and is a static component of the
 * machine. It's responsibility is to map the incoming keyboard (or Plugboard)
 * connections into the remaining wheels (rotors) and back out again.
 */
export class Stator implements IEncodable, IValidatable {
  /**
   * Displayable label (or name) for this Stator.
   */
  readonly label:string;

  /**
   * The maximum number of characters. For the standard latin alphabet rings
   * this value should be 26. The Funkschlüssel C has 28, and the Model Z has
   * 10.
   */
  readonly numCharacters:number;

  /**
   * Internal mapping of character indices to an output index.
   */
  readonly mapping:Array<number>;

  constructor(label:string, numChars:number, map:Array<number>) {
    // Bind methods
    this.encode = this.encode.bind(this);

    // Setup variables
    if(!label || label.length < 1)
      throw new TypeError(`Stator constructed with parameter 1 "label" being empty.`);
    this.label = label;

    if(numChars <= 0)
      throw new TypeError(`Stator constructed with parameter 2 "numChars" being 0 or under. Please use a positive value.`);
    this.numCharacters = numChars;

    if(!map || !Array.isArray(map) || map.length !== numChars)
      throw new TypeError(`Stator constructed with parameter 3 "map" being empty, or not of length "${numChars}" as specified by "numChars".`);
    this.mapping = map;
  }

  /**
   * Performs the encoding of a given index into another.
   * 
   * For the Stators this is generally 1-to-1.
   * 
   * @implements IEncodable
   * @param index Input character index
   * @returns New character index
   */
  public encode(index:number):number {
    return this.mapping[ circular(index, this.numCharacters) ];
  }

  /**
   * Checks that this Stator's settings are valid.
   * 
   * A Stator is considered invalid if any of the mappings repeat.
   * 
   * @returns Undefined for no errors, or an Array of error objects
   */
  public validate():OptErrors {
    const dups:Array<[number, number]> = findDuplicates<number>(this.mapping);

    if(dups.length)
      return dups.map(([ ind, val ]) => new Error(`Stator.mapping[${ind}] is a duplicate value '${val}'`));
  }
}
export default Stator;
