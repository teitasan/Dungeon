/**
 * Tests for TurnSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TurnSystem } from '../TurnSystem';
import { PlayerEntity } from '../../entities/Player';
import { MonsterEntity } from '../../entities/Monster';
import { CompanionEntity } from '../../entities/Companion';
import { TurnAction } from '../../types/movement';

describe('TurnSystem', () => {
  let turnSystem: TurnSystem;
  let player: PlayerEntity;
  let monster: MonsterEntity;
  let companion: CompanionEntity;

  beforeEach(() => {
    turnSystem = new TurnSystem();
    player = new PlayerEntity('player-1', 'Hero', { x: 5, y: 5 });
    monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', { x: 3, y: 3 });
    companion = new CompanionEntity('companion-1', 'Ally', 'warrior', { x: 7, y: 7 });
  });

  it('should initialize with empty turn order', () => {
    expect(turnSystem.getCurrentEntity()).toBeNull();
    expect(turnSystem.getCurrentTurn()).toBe(1);
    expect(turnSystem.getCurrentPhase()).toBe('player-action');
  });

  it('should initialize turn order with entities', () => {
    const entities = [player, monster, companion];
    turnSystem.initializeTurnOrder(entities);
    
    expect(turnSystem.getCurrentEntity()).toBe(player);
    expect(turnSystem.getCurrentTurn()).toBe(1);
    expect(turnSystem.getCurrentPhase()).toBe('player-action');
  });

  it('should add and remove entities', () => {
    turnSystem.addEntity(player);
    expect(turnSystem.getCurrentEntity()).toBe(player);
    
    turnSystem.addEntity(monster);
    turnSystem.addEntity(companion);
    
    turnSystem.removeEntity(player);
    expect(turnSystem.getCurrentEntity()).toBe(monster);
  });

  it('should process valid turn actions', () => {
    turnSystem.initializeTurnOrder([player, monster]);
    
    const action: TurnAction = {
      type: 'move',
      entity: player,
      data: { direction: 'north' },
      cost: 1.0
    };
    
    expect(turnSystem.processTurnAction(action)).toBe(true);
    expect(turnSystem.getCurrentEntity()).toBe(monster);
  });

  it('should reject actions from wrong entity', () => {
    turnSystem.initializeTurnOrder([player, monster]);
    
    const action: TurnAction = {
      type: 'move',
      entity: monster, // Not player's turn
      data: { direction: 'north' },
      cost: 1.0
    };
    
    expect(turnSystem.processTurnAction(action)).toBe(false);
    expect(turnSystem.getCurrentEntity()).toBe(player); // Should still be player's turn
  });

  it('should advance turns correctly', () => {
    turnSystem.initializeTurnOrder([player, monster, companion]);
    
    expect(turnSystem.getCurrentEntity()).toBe(player);
    
    turnSystem.advanceTurn();
    expect(turnSystem.getCurrentEntity()).toBe(monster);
    
    turnSystem.advanceTurn();
    expect(turnSystem.getCurrentEntity()).toBe(companion);
    
    turnSystem.advanceTurn();
    expect(turnSystem.getCurrentPhase()).toBe('recovery');
  });

  it('should advance phases correctly', () => {
    turnSystem.initializeTurnOrder([player]);
    
    expect(turnSystem.getCurrentPhase()).toBe('player-action');
    
    // Complete all entities in current phase
    turnSystem.advanceTurn();
    expect(turnSystem.getCurrentPhase()).toBe('recovery');
    
    turnSystem.advanceTurn();
    expect(turnSystem.getCurrentPhase()).toBe('ally-movement');
  });

  it('should increment turn counter after full cycle', () => {
    turnSystem.initializeTurnOrder([player]);
    
    expect(turnSystem.getCurrentTurn()).toBe(1);
    
    // Go through all phases
    const phases = ['player-action', 'recovery', 'ally-movement', 'enemy-movement', 'traps', 'attacks', 'end-turn'];
    
    for (let i = 0; i < phases.length; i++) {
      turnSystem.advanceTurn();
    }
    
    expect(turnSystem.getCurrentTurn()).toBe(2);
    expect(turnSystem.getCurrentPhase()).toBe('player-action');
  });

  it('should skip turns correctly', () => {
    turnSystem.initializeTurnOrder([player, monster]);
    
    expect(turnSystem.getCurrentEntity()).toBe(player);
    
    turnSystem.skipTurn();
    expect(turnSystem.getCurrentEntity()).toBe(monster);
  });

  it('should check if it is entity turn', () => {
    turnSystem.initializeTurnOrder([player, monster]);
    
    expect(turnSystem.isEntityTurn(player)).toBe(true);
    expect(turnSystem.isEntityTurn(monster)).toBe(false);
    
    turnSystem.advanceTurn();
    
    expect(turnSystem.isEntityTurn(player)).toBe(false);
    expect(turnSystem.isEntityTurn(monster)).toBe(true);
  });

  it('should create turn actions correctly', () => {
    const action = turnSystem.createAction('move', player, { direction: 'north' }, 1.0);
    
    expect(action.type).toBe('move');
    expect(action.entity).toBe(player);
    expect(action.data).toEqual({ direction: 'north' });
    expect(action.cost).toBe(1.0);
  });

  it('should provide turn statistics', () => {
    turnSystem.initializeTurnOrder([player, monster, companion]);
    
    const stats = turnSystem.getTurnStats();
    
    expect(stats.currentTurn).toBe(1);
    expect(stats.currentPhase).toBe('player-action');
    expect(stats.currentEntity).toBe('player-1');
    expect(stats.totalEntities).toBe(3);
    expect(stats.entityIndex).toBe(0);
  });

  it('should handle partial turn actions', () => {
    turnSystem.initializeTurnOrder([player, monster]);
    
    const halfTurnAction: TurnAction = {
      type: 'special',
      entity: player,
      data: { action: 'pickup' },
      cost: 0.5
    };
    
    expect(turnSystem.processTurnAction(halfTurnAction)).toBe(true);
    expect(turnSystem.getCurrentEntity()).toBe(player); // Should still be player's turn
    
    const fullTurnAction: TurnAction = {
      type: 'move',
      entity: player,
      data: { direction: 'north' },
      cost: 1.0
    };
    
    expect(turnSystem.processTurnAction(fullTurnAction)).toBe(true);
    expect(turnSystem.getCurrentEntity()).toBe(monster); // Now should be monster's turn
  });

  it('should reset correctly', () => {
    turnSystem.initializeTurnOrder([player, monster, companion]);
    turnSystem.advanceTurn();
    turnSystem.advanceTurn();
    
    turnSystem.reset();
    
    expect(turnSystem.getCurrentEntity()).toBeNull();
    expect(turnSystem.getCurrentTurn()).toBe(1);
    expect(turnSystem.getCurrentPhase()).toBe('player-action');
  });

  it('should set phase directly', () => {
    turnSystem.initializeTurnOrder([player, monster]);
    
    turnSystem.setPhase('enemy-movement');
    
    expect(turnSystem.getCurrentPhase()).toBe('enemy-movement');
  });

  it('should handle phase listeners', () => {
    let callbackCalled = false;
    let callbackEntities: any[] = [];
    
    turnSystem.addPhaseListener('recovery', (entities) => {
      callbackCalled = true;
      callbackEntities = entities;
    });
    
    turnSystem.initializeTurnOrder([player]);
    turnSystem.setPhase('recovery');
    
    expect(callbackCalled).toBe(true);
    expect(Array.isArray(callbackEntities)).toBe(true);
  });
});