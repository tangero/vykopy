/**
 * Integration examples for notification triggers
 * 
 * This file shows how to integrate notification triggers into existing services and API routes.
 * Copy these patterns into your actual route handlers and service methods.
 */

import { Request, Response } from 'express';
import { ProjectModel } from '../models/Project';
import { UserModel } from '../models/User';
import { notificationTriggers } from './NotificationTriggers';
import { Project, ProjectState, User, CreateProjectRequest, UpdateProjectRequest } from '../types';

/**
 * Example: Project creation with notifications
 */
export async function createProjectWithNotifications(
  req: Request, 
  res: Response, 
  projectModel: ProjectModel
): Promise<void> {
  try {
    const projectData: CreateProjectRequest = req.body;
    const applicantId = req.user!.id;

    // Create the project
    const project = await projectModel.create(projectData, applicantId);

    // Trigger notifications
    await notificationTriggers.onProjectCreated(project);

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project'
    });
  }
}

/**
 * Example: Project state change with notifications
 */
export async function changeProjectStateWithNotifications(
  req: Request, 
  res: Response, 
  projectModel: ProjectModel
): Promise<void> {
  try {
    const { id } = req.params;
    const { state } = req.body;
    const userId = req.user!.id;

    // Get current project state
    const currentProject = await projectModel.findById(id);
    if (!currentProject) {
      res.status(404).json({
        success: false,
        error: 'Project not found'
      });
      return;
    }

    const oldState = currentProject.state;

    // Change the state
    const updatedProject = await projectModel.changeState(id, state, userId);
    if (!updatedProject) {
      res.status(400).json({
        success: false,
        error: 'Failed to change project state'
      });
      return;
    }

    // Trigger notifications
    await notificationTriggers.onProjectStateChanged(updatedProject, oldState, userId);

    res.json({
      success: true,
      data: updatedProject
    });
  } catch (error) {
    console.error('Failed to change project state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change project state'
    });
  }
}

/**
 * Example: Project update with notifications
 */
export async function updateProjectWithNotifications(
  req: Request, 
  res: Response, 
  projectModel: ProjectModel
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData: UpdateProjectRequest = req.body;
    const userId = req.user!.id;

    // Get current project
    const currentProject = await projectModel.findById(id);
    if (!currentProject) {
      res.status(404).json({
        success: false,
        error: 'Project not found'
      });
      return;
    }

    // Update the project
    const updatedProject = await projectModel.update(id, updateData);
    if (!updatedProject) {
      res.status(400).json({
        success: false,
        error: 'Failed to update project'
      });
      return;
    }

    // Trigger notifications
    await notificationTriggers.onProjectUpdated(updatedProject, currentProject, userId);

    res.json({
      success: true,
      data: updatedProject
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project'
    });
  }
}

/**
 * Example: User registration with notifications
 */
export async function registerUserWithNotifications(
  req: Request, 
  res: Response
): Promise<void> {
  try {
    const { email, password, name, organization } = req.body;

    // Create the user
    const newUser = await UserModel.create({
      email,
      password,
      name,
      organization
    });

    // Trigger notifications
    await notificationTriggers.onUserRegistered(newUser);

    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        organization: newUser.organization,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Failed to register user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
}

/**
 * Example: Comment creation with notifications
 */
export async function addCommentWithNotifications(
  req: Request, 
  res: Response, 
  projectModel: ProjectModel
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    // Get the project
    const project = await projectModel.findById(projectId);
    if (!project) {
      res.status(404).json({
        success: false,
        error: 'Project not found'
      });
      return;
    }

    // Create the comment (this would be in a CommentModel)
    const comment = {
      id: 'generated-id', // Would be generated by database
      projectId,
      userId,
      content,
      createdAt: new Date()
    };

    // Get comment author
    const commentAuthor = await UserModel.findById(userId);
    if (!commentAuthor) {
      res.status(400).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Trigger notifications
    await notificationTriggers.onCommentAdded(project, comment, commentAuthor);

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Failed to add comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment'
    });
  }
}

/**
 * Example: Manual deadline check endpoint (for admin use)
 */
export async function triggerDeadlineCheck(req: Request, res: Response): Promise<void> {
  try {
    // Only allow regional admins to trigger this
    if (req.user!.role !== 'regional_admin') {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    await notificationTriggers.triggerDeadlineCheck();

    res.json({
      success: true,
      message: 'Deadline check completed'
    });
  } catch (error) {
    console.error('Failed to trigger deadline check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger deadline check'
    });
  }
}

/**
 * Example: Get notification system status (for admin monitoring)
 */
export async function getNotificationStatus(req: Request, res: Response): Promise<void> {
  try {
    // Only allow regional admins to view this
    if (req.user!.role !== 'regional_admin') {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    const status = notificationTriggers.getSystemStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Failed to get notification status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification status'
    });
  }
}

/**
 * Integration patterns for existing code:
 * 
 * 1. In your project routes (e.g., src/routes/projects.ts):
 *    - Import: import { notificationTriggers } from '../services/NotificationTriggers';
 *    - After creating project: await notificationTriggers.onProjectCreated(project);
 *    - After state change: await notificationTriggers.onProjectStateChanged(project, oldState, userId);
 * 
 * 2. In your user registration route:
 *    - After user creation: await notificationTriggers.onUserRegistered(newUser);
 * 
 * 3. In your comment routes:
 *    - After comment creation: await notificationTriggers.onCommentAdded(project, comment, author);
 * 
 * 4. In your moratorium routes:
 *    - After moratorium creation: await notificationTriggers.onMoratoriumCreated(moratorium);
 * 
 * 5. In your conflict detection service:
 *    - After detecting conflicts: await notificationTriggers.onConflictsDetected(project, conflicts);
 */