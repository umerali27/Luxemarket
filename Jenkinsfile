pipeline {
    agent any

    environment {
        IMAGE_NAME = 'luxemarket-api'
        CONTAINER_NAME = 'luxemarket-app'
        PORT = '3001'
    }

    stages {
        stage('Checkout Code') {
            steps {
                // Pulls the latest code from your GitHub repository
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                echo 'Building the Docker image...'
                // Builds the image using the Dockerfile and our optimization rules
                sh "docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Deploy Container') {
            steps {
                echo 'Deploying application...'
                // Stop and remove the old container if it exists safely
                sh """
                docker stop ${CONTAINER_NAME} || true
                docker rm ${CONTAINER_NAME} || true
                docker run -d \
                  -p ${PORT}:${PORT} \
                  --name ${CONTAINER_NAME} \
                  ${IMAGE_NAME}:latest
                """
            }
        }
        
        stage('Sanity Check') {
            steps {
                echo 'Checking if container is stable...'
                sh "sleep 5"
                sh "docker ps | grep ${CONTAINER_NAME}"
            }
        }
    }

    post {
        always {
            echo 'Cleaning up dangling Docker images...'
            // Cleans up unused older image layers to prevent filling up EC2 storage
            sh 'docker image prune -f || true'
        }
    }
}
