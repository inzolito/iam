$startupScript = @"
#!/bin/bash
apt-get update
apt-get install -y docker.io
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker run -d --name frontend --restart always -p 3000:3000 -p 80:3000 -e HOST=0.0.0.0 us-central1-docker.pkg.dev/maikbottrade/analytica-repo/frontend:latest
"@

gcloud compute instances create analytica-frontend-vm --machine-type=e2-micro --zone=us-central1-a --tags=analytica-frontend,http-server --scopes=https://www.googleapis.com/auth/cloud-platform --image-family=debian-12 --image-project=debian-cloud --metadata=startup-script=$startupScript
